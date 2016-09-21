'use strict';

var through         = require('through2');
var path            = require('path');
var bless           = require('bless');
var gutil           = require('gulp-util');
var merge           = require('merge');
var applySourcemap  = require('vinyl-sourcemaps-apply');

var File = gutil.File;
var PluginError = gutil.PluginError;

module.exports = function(options){
    var pluginName = 'gulp-bless';
    options = options || {};
    options.imports = options.imports === undefined ? true : options.imports;
    options.cacheBuster = options.cacheBuster === undefined ? true : options.cacheBuster;
    options.partLabel = options.partLabel === undefined ? "-blessed" : options.partLabel;

    return through.obj(function(file, enc, cb) {
        if (file.isNull()) return cb(null, file); // ignore
        if (file.isStream()) return cb(new PluginError(pluginName,  'Streaming not supported'));

        var stream = this;
        var shouldCreateSourcemaps = file.sourceMap;

        if (file.contents && file.contents.toString()) {
            var fileName = path.basename(file.path);
            var outputFilePath = path.resolve(path.dirname(file.path), fileName);
            var contents = file.contents.toString('utf8');


            try {
                var result = bless.chunk(contents, {
                    source: outputFilePath,
                    sourcemaps: shouldCreateSourcemaps
                });
            }
            catch (err) {
                return cb(new PluginError(pluginName,  err));
            }

            var numberOfSplits = result.data.length;


            if (options.log) {
                // print log message
                var msg = 'Found ' + result.totalSelectorCount + ' selector';
                if (result.data.length > 1) {
                    msg += 's, splitting into ' + result.data.length + ' blessedFiles.';
                } else {
                    msg += ', not splitting.';
                }
                gutil.log(msg);
            }

            var addSourcemap = function(fileToAddTo, blessOutputIndex) {
                if(!shouldCreateSourcemaps) return fileToAddTo;
                applySourcemap(fileToAddTo, {
                    version: 3,
                    file: fileToAddTo.relative,
                    sources: [file.relative],
                    mappings: result.maps[blessOutputIndex]
                });
                return fileToAddTo;
            };


            // get out early if the file isn't long enough
            if(result.data.length === 1){
                return cb(null, addSourcemap(new File({
                    cwd: file.cwd,
                    base: file.base,
                    path: outputFilePath,
                    contents: new Buffer(result.data[0])
                }, 0)));
            }


            var outputPathStart = path.dirname(outputFilePath);
            var outputExtension = path.extname(outputFilePath);
            var outputBasename = path.basename(outputFilePath, outputExtension);

            var createBlessedFileName = function(index){
                return outputBasename + options.partLabel + index + outputExtension;
            };

            var addImports = function(index, contents){
                // only the first file should have @imports
                if(!options.imports || index){
                  return contents;
                }

                var imports = '';
                var parameters = options.cacheBuster ? '?z=' + Math.round((Math.random() * 999)) : '';
                for (var i = 1; i < numberOfSplits; i++) {
                    imports += "@import url('" + createBlessedFileName(i) + parameters + "');\n\n";
                }

                return imports + contents;
            };


            var outputFiles = [];
            for(var j = numberOfSplits - 1; j >= 0; j--) {
                var newIndex = numberOfSplits - 1 - j;
                var outputPath = newIndex
                    ? path.resolve(path.join(outputPathStart, createBlessedFileName(newIndex)))
                    : outputFilePath;

                outputFiles[newIndex] = addSourcemap(new File({
                    cwd: file.cwd,
                    base: file.base,
                    path: outputPath,
                    contents: new Buffer(addImports(newIndex, result.data[j]))
                }), j);
            }


            for(var k = 0; k < numberOfSplits; k++){
                stream.push(outputFiles[k]);
            }
            cb()
        } else {
            cb(null, file);
        }
    });
};
