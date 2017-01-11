'use strict';

var isString        = require("lodash.isstring");
var isFunction      = require("lodash.isfunction");
var isUndefined     = require("lodash.isundefined");
var through         = require('through2');
var path            = require('path');
var bless           = require('bless');
var gutil           = require('gulp-util');
var merge           = require('merge');
var applySourcemap  = require('vinyl-sourcemaps-apply');

var File = gutil.File;
var PluginError = gutil.PluginError;
var createSuffixFunctionFromString = function(configValue) {
    var actualSuffix = configValue === undefined? "-blessed" : configValue;
    return function(index) {
        return actualSuffix + index;
    }
}
var createSuffixFunction = function(configValue) {
    if(isString(configValue) || isUndefined(configValue)) {
        return createSuffixFunctionFromString(configValue);
    } else if(isFunction(configValue)) {
        return configValue;
    } else {
        throw new TypeError("suffix is neither a string nor function");
    }
}

module.exports = function(options){
    var pluginName = 'gulp-bless';
    options = options || {};
    options.imports = options.imports === undefined ? true : options.imports;
    options.cacheBuster = options.cacheBuster === undefined ? true : options.cacheBuster;
    options.suffix = createSuffixFunction(options.suffix);

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

                var map = result.maps[blessOutputIndex];
                map.file = fileToAddTo.relative;
                map.sources = [file.relative];
                applySourcemap(fileToAddTo, map);

                return fileToAddTo;
            };


            // get out early if the file isn't long enough
            if(result.data.length === 1){
                return cb(null, addSourcemap(new File({
                    cwd: file.cwd,
                    base: file.base,
                    path: outputFilePath,
                    contents: new Buffer(result.data[0])
                }), 0));
            }


            var outputPathStart = path.dirname(outputFilePath);
            var outputExtension = path.extname(outputFilePath);
            var outputBasename = path.basename(outputFilePath, outputExtension);

            var createBlessedFileName = function(index){
                return outputBasename + options.suffix(index) + outputExtension;
            };

            var addImports = function(contents){
                // only the first file should have @imports
                if(!options.imports){
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
            for(var j = 0; j < numberOfSplits; j++) {
                var oneBasedIndex = j + 1;
                var isAtLastElement = j == numberOfSplits - 1;
                var outputPath = isAtLastElement
                    ? outputFilePath
                    : path.resolve(path.join(outputPathStart, createBlessedFileName(oneBasedIndex)));  
                var newContensts = isAtLastElement
                    ? new Buffer(addImports(result.data[j]))
                    : new Buffer(result.data[j]);
                outputFiles[j] = addSourcemap(new File({
                    cwd: file.cwd,
                    base: file.base,
                    path: outputPath,
                    contents: newContensts
                }), j);
            }

            //we want the file without the suffix (last element in the array) to be at the front of the stream so we 
            //need to push to stream differently.
            for(var k = 0; k < numberOfSplits; k++){
                var fileToPush = k == 0
                    ? outputFiles[numberOfSplits - 1]
                    : outputFiles[k - 1];
                stream.push(fileToPush);
            }
            cb()
        } else {
            cb(null, file);
        }
    });
};
