var mockrequire = require('proxyquire');

var bless       = require('../');
var concat      = require("gulp-concat");
var cleanCss    = require('gulp-clean-css');
var should      = require('should');
var fs          = require('fs');
var path        = require('path');
var File        = require('gulp-util').File;
var Buffer      = require('buffer').Buffer;
var assert      = require('stream-assert');
var gulp        = require('gulp');
var sass        = require('gulp-sass');
var $           = require('gulp-load-plugins')({scope: 'devDependencies'});

var SourceMapConsumer = require('source-map').SourceMapConsumer;

describe('gulp-bless', function() {
    describe('bless()', function() {

        it('should do nothing if under the limit', function(done){
            var stream = bless(),
                numberOfNewFiles = 0;

            stream.on('data', function(newFile){
                numberOfNewFiles++;

                should.exist(newFile);
                should.exist(newFile.path);
                should.exist(newFile.relative);
                should.exist(newFile.contents);

                newFile.relative.should.equal('file.css');
                newFile.contents.toString('utf8').should.equal('p {\n  color: red;\n}');
                Buffer.isBuffer(newFile.contents).should.equal(true);
            });

            stream.on('end', function(){
                numberOfNewFiles.should.equal(1);
                done();
            });

            stream.write(new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("p {color:red}")
            }));
            stream.emit('end');
        });


        it("should pass through a file if it's empty", function(done){
            var stream = bless(),
                numberOfNewFiles = 0;

            stream.on('data', function(newFile){
                numberOfNewFiles++;
                newFile.contents.toString('utf8').should.equal('');
                Buffer.isBuffer(newFile.contents).should.equal(true);
            });

            stream.on('end', function(){
                numberOfNewFiles.should.equal(1);
                done();
            });

            stream.write(new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/empty.css",
                contents: new Buffer("")
            }));
            stream.end();
        });


        it('should split when selector count is over the limit', function(done){
            var stream = bless();

            fs.readFile('./test/css/long.css', function(err, data){
                if(err) throw new Error(err);

                var longStylesheet = new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                    }),
                    expectedSplits = [];

                fs.readFile('./test/css/long-split.css', function(err, data){
                    if(err) throw new Error(err);

                    expectedSplits.push(new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                    }));

                    fs.readFile('./test/css/long-split-blessed1.css', function(err, data){
                        if(err) throw new Error(err);

                        expectedSplits.push(new File({
                            cwd: "/home/adam/",
                            base: "/home/adam/test",
                            path: "/home/adam/test/long-split-blessed1.css",
                            contents: new Buffer(data)
                        }));

                        var index = 0, //expectedSplits.length - 1,
                            numberOfNewFiles = 0;

                        stream.on('data', function(newFile){
                            numberOfNewFiles++;

                            should.exist(newFile);
                            should.exist(newFile.path);
                            should.exist(newFile.relative);
                            should.exist(newFile.contents);

                            var expectedSplitFile = expectedSplits[index];
                            newFile.relative.should.equal(path.basename(expectedSplitFile.path));

                            var contents = newFile.contents.toString('utf8').replace(/\?z=[0-9]+'\)/g, "?z=xxx')");

                            contents.should.equal(expectedSplitFile.contents.toString('utf8'));
                            Buffer.isBuffer(newFile.contents).should.equal(true);
                            should.not.exist(newFile.sourceMap);
                            index++;
                        });

                        stream.on('end', function(){
                            numberOfNewFiles.should.equal(2);
                            done();
                        });

                        stream.write(longStylesheet);
                        stream.emit('end');
                    });
                });
            });
        });

        it('should use custom suffix if suffix option is set to a string', function(done){
            var suffix = "-part"
            var stream = bless({
                suffix: suffix
            });

            fs.readFile('./test/css/long.css', function(err, data){
                if(err) throw new Error(err); 

                var longStylesheet = new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                });

                var actualSplits = []
                stream.on("data", function(newFile){
                    actualSplits.push(newFile);
                });

                stream.on("end", function(){
                    actualSplits.should.have.length(2);
                    var masterPart, subPart;
                    actualSplits.forEach(function(splittedFile){
                        should.exist(splittedFile);
                        should.exist(splittedFile.path);
                        should.exist(splittedFile.relative);
                        should.exist(splittedFile.contents);
                        if (path.basename(splittedFile.path) === "long-split.css") {
                            masterPart = splittedFile;
                        } else {
                            subPart = splittedFile;
                        }
                    });
                    should.exist(masterPart);
                    should.exist(subPart);
                    path.basename(subPart.path).should.equal("long-split" + suffix + "1.css");
                    var importRegex = "@import url\\('long-split" + suffix  + "1.css\\?z=[0-9]+'\\);";
                    masterPart.contents.toString("utf8").should.match(new RegExp(importRegex));
                    done();
                });

                stream.write(longStylesheet)  
                stream.emit("end")             
            });
        });

        it('should use custom suffix if suffix option is set to a function', function(done){
            var suffix = "-functionpart";
            var stream = bless({
                suffix: function(index) {
                    return suffix + "-" + index;
                }
            });

            fs.readFile('./test/css/long.css', function(err, data){
                if(err) throw new Error(err); 

                var longStylesheet = new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                });

                var actualSplits = []
                stream.on("data", function(newFile){
                    actualSplits.push(newFile);
                });

                stream.on("end", function(){
                    actualSplits.should.have.length(2);
                    var masterPart, subPart;
                    actualSplits.forEach(function(splittedFile){
                        should.exist(splittedFile);
                        should.exist(splittedFile.path);
                        should.exist(splittedFile.relative);
                        should.exist(splittedFile.contents);
                        if (path.basename(splittedFile.path) === "long-split.css") {
                            masterPart = splittedFile;
                        } else {
                            subPart = splittedFile;
                        }
                    });
                    should.exist(masterPart);
                    should.exist(subPart);
                    path.basename(subPart.path).should.equal("long-split" + suffix + "-1.css");
                    var importRegex = "@import url\\('long-split" + suffix  + "-1.css\\?z=[0-9]+'\\);";
                    masterPart.contents.toString("utf8").should.match(new RegExp(importRegex));
                    done();
                });

                stream.write(longStylesheet)  
                stream.emit("end")             
            });
        });

        it('should throw error if suffix option is neither string nor function', function(done){ 

            (function callBlessWithInvalidSuffix() {
                gulp.src('./test/css/long.css')
                    .pipe(bless({suffix:{}}))
            }).should.throw(/.*suffix.*string.*function.*/);
            done();
        });

        it('should apply sourcemaps', function(done){
            var expectedSplits = [
                new File({
                    cwd: "/home/test/",
                    base: "/home/test/css",
                    path: "/home/test/css/long-split.css",
                    contents: new Buffer(fs.readFileSync('./test/css/long-split.css').toString('utf8'))
                }),
                new File({
                    cwd: "/home/test/",
                    base: "/home/test/css",
                    path: "/home/test/css/long-split-blessed1.css",
                    contents: new Buffer(fs.readFileSync('./test/css/long-split-blessed1.css').toString('utf8'))
                })
            ];

            gulp.src('./test/css/long.css')
                .pipe($.rename({
                    suffix: '-split'
                }))
                .pipe($.sourcemaps.init())
                .pipe(bless())
                .pipe(assert.length(2))
                .pipe(assert.first(function(result) {
                    path.relative('./', result.path).should.equal(path.relative('/home', expectedSplits[0].path));
                    result.contents.toString('utf8')
                        .replace(/\?z=[0-9]+'\)/g, "?z=xxx')")
                        .should.equal(expectedSplits[0].contents.toString('utf8'));

                    result.sourceMap.sources.should.have.length(1);
                    result.sourceMap.sources[0].should.match(/long-split\.css$/);
                    result.sourceMap.file.should.equal(path.basename(expectedSplits[0].path));

                    var sourceMapConsumer = new SourceMapConsumer(result.sourceMap);
                    sourceMapConsumer.eachMapping(function(oneMapping) {
                        oneMapping.source.should.equal('long-split.css');
                        oneMapping.originalLine.should.equal(4096); //this split contains the one extra line
                    })
                    
                }))
                .pipe(assert.second(function(result) {
                    path.relative('./', result.path).should.equal(path.relative('/home', expectedSplits[1].path));
                    result.contents.toString('utf8').should.equal(expectedSplits[1].contents.toString('utf8'));

                    result.sourceMap.sources.should.have.length(1);
                    result.sourceMap.sources[0].should.match(/long-split\.css$/);
                    result.sourceMap.file.should.equal(path.basename(expectedSplits[1].path));
                    var sourceMapConsumer = new SourceMapConsumer(result.sourceMap);
                    var mappedLine = [];
                    for (var i = 0; i < 4095; i++) {
                        mappedLine.push(false);
                    }
                    sourceMapConsumer.eachMapping(function(oneMapping) {
                        oneMapping.source.should.equal('long-split.css');
                        //each of the line (up to 4095 ) should get mapped to something
                        mappedLine[oneMapping.originalLine - 1] = true;
                    })

                    mappedLine.forEach(function (visited, index) {
                        visited.should.equal(true, "did not find a mapping for line " + (index + 1) + " in original file");
                    })
                }))
                .pipe(assert.end(done));
        });

        /* Issue 36 test */
        it('should apply sourcemaps correctly for no split and combined with other processor', function(done) {      
            var testCssDir = 'test/css'; 
            var testFileName = testCssDir + '/small.css';
            var concatName = 'small.contacted.css';
            var mappingsDir = 'generated-sourcemaps';
            gulp.src(testFileName)
                .pipe($.sourcemaps.init())
                .pipe(concat(concatName))
                .pipe(bless())
                .pipe(cleanCss({processImport: false}))
                .pipe($.sourcemaps.write(mappingsDir))
                .pipe(assert.length(2))
                .pipe(assert.nth(0, function(result){
                    result.relative.should.equal(path.join(mappingsDir, concatName) + '.map');
                    var mappingData = JSON.parse(result.contents.toString('utf8'));
                    mappingData.version.should.equal(3);
                    mappingData.names.should.be.empty();
                    mappingData.sources.should.deepEqual([path.basename(testFileName)]);
                    mappingData.file.should.equal('../' + concatName);
                    mappingData.sourcesContent.should.deepEqual(['.small{font-size: 10px}']);

                    var sourceMapConsumer = new SourceMapConsumer(mappingData);
                    sourceMapConsumer.eachMapping(function(oneMapping) {
                        oneMapping.source.should.equal(path.basename(testFileName));
                        oneMapping.originalLine.should.equal(1, "everything shoud map to line 1 in original scss file");
                        oneMapping.originalColumn.should.equal(0, "everything should map to column 0 in original scss file");
                    })
                }))
                .pipe(assert.nth(1, function(result) {
                    result.relative.should.equal(concatName);
                    var minifiedCssRegex = '\\.small{font-size:10px}[^]+sourceMappingURL=' + mappingsDir + '/' + concatName + '\\.map[^]*';
                    result.contents.toString('utf8').should.match(new RegExp(minifiedCssRegex));
                }))
                .pipe(assert.end(done));
        });

        it('should apply sourcemaps correctly when there already is a sourcemap also produces correct sourcemap upon split', function(done){
            this.timeout(5000); //yea .. this test reads larger data so needs more time

            var expectedSplits = [
                new File({
                    cwd: "/home/test/",
                    base: "/home/test/css",
                    path: "/home/test/css/long-split.css",
                    contents: new Buffer(fs.readFileSync('./test/css/long-split-with-sourcemap-comment.css').toString('utf8'))
                }),
                new File({
                    cwd: "/home/test/",
                    base: "/home/test/css",
                    path: "/home/test/css/long-split-blessed1.css",
                    contents: new Buffer(fs.readFileSync('./test/css/long-split-blessed1-with-sourcemap-comment.css').toString('utf8'))
                })
            ];

            var concatName = "long-split.css";
            var sourceName = "small.css";

            gulp.src('./test/css/long-parent.scss')
                .pipe($.sourcemaps.init())
                .pipe(sass({outputStyle: 'expanded'}))
                .pipe(concat(concatName))
                .pipe(bless())
                .pipe(cleanCss({processImport: false, advanced: false}))
                .pipe($.sourcemaps.write('./generated-sourcemaps'))
                .pipe(assert.length(4))
                .pipe(assert.nth(0, function(result) {
                    result.path.should.match(/long-split\.css\.map$/);
                    var sourceMapPart1 = JSON.parse(result.contents.toString('utf8'));
                    sourceMapPart1.version.should.equal(3);
                    sourceMapPart1.file.should.equal("../" + concatName);
                    sourceMapPart1.sources.should.deepEqual([sourceName])
                    //yes, souce content should be from the small.css which included by long-parent.scss
                    sourceMapPart1.sourcesContent.should.deepEqual(['.small{font-size: 10px}']);
                    var sourceMapConsumer = new SourceMapConsumer(sourceMapPart1);
                    sourceMapConsumer.eachMapping(function(oneMapping) {
                        oneMapping.source.should.equal(path.basename(sourceName));
                        oneMapping.originalLine.should.equal(1, "everything shoud map to line 1 in original scss file");
                    })

                }))
                .pipe(assert.nth(1, function(result) {
                    path.relative('./', result.path).should.equal(path.relative('/home', expectedSplits[0].path));
                    result.contents.toString('utf8')
                        .replace(/\?z=[0-9]+\)/g, "?z=xxx)")
                        .should.equal(expectedSplits[0].contents.toString('utf8'), "not equal to content of file ./test/css/long-split-with-sourcemap-comment.css");

                    result.sourceMap.sources.should.have.length(1);
                    result.sourceMap.sources.should.deepEqual([sourceName]);
                    result.sourceMap.file.should.equal('../' + path.basename(expectedSplits[0].path));
                    var sourceMapConsumer = new SourceMapConsumer(result.sourceMap);
                    sourceMapConsumer.eachMapping(function(oneMapping) {
                        oneMapping.source.should.equal(path.basename(sourceName));
                        oneMapping.originalLine.should.equal(1, "everything shoud map to line 1 in original scss file");
                    })
                }))
                .pipe(assert.nth(2, function(result) {
                    result.path.should.match(/long-split-blessed1\.css\.map$/);
                    var sourceMapPart2 = JSON.parse(result.contents.toString('utf8'));
                    sourceMapPart2.version.should.equal(3);
                    sourceMapPart2.file.should.equal("../long-split-blessed1.css")
                    sourceMapPart2.sources.should.deepEqual(["small.css"])
                    sourceMapPart2.sourcesContent.should.deepEqual(['.small{font-size: 10px}']);
                    var sourceMapConsumer = new SourceMapConsumer(sourceMapPart2);
                    sourceMapConsumer.eachMapping(function(oneMapping) {
                        oneMapping.source.should.equal(path.basename(sourceName));
                        oneMapping.originalLine.should.equal(1, "everything shoud map to line 1 in original scss file");
                    })
                }))
                .pipe(assert.nth(3, function(result) {
                    path.relative('./', result.path).should.equal(path.relative('/home', expectedSplits[1].path));
                    result.contents.toString('utf8').should.equal(
                        expectedSplits[1].contents.toString('utf8'),
                        "not equal to content of file ./test/css/long-split-blessed1-with-sourcemap-comment.css"
                    );

                    result.sourceMap.sources.should.have.length(1);
                    result.sourceMap.sources.should.deepEqual([sourceName]);
                    result.sourceMap.file.should.equal('../' + path.basename(expectedSplits[1].path));
                    var sourceMapConsumer = new SourceMapConsumer(result.sourceMap);
                    sourceMapConsumer.eachMapping(function(oneMapping) {
                        oneMapping.source.should.equal(path.basename(sourceName));
                        oneMapping.originalLine.should.equal(1, "everything shoud map to line 1 in original scss file");
                    })
                }))
                .pipe(assert.end(done))
        });


        it("shouldn't add parameters to @imports if the cacheBuster option is false", function(done){
            var stream = bless({
                cacheBuster: false
            });

            fs.readFile('./test/css/long.css', function(err, data){
                if(err) throw new Error(err);

                var longStylesheet = new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                    }),
                    expectedSplits = [];

                fs.readFile('./test/css/long-split--no-cache-buster.css', function(err, data){
                    if(err) throw new Error(err);

                    expectedSplits.push(new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                    }));

                    fs.readFile('./test/css/long-split-blessed1.css', function(err, data){
                        if(err) throw new Error(err);

                        expectedSplits.push(new File({
                            cwd: "/home/adam/",
                            base: "/home/adam/test",
                            path: "/home/adam/test/long-split-blessed1.css",
                            contents: new Buffer(data)
                        }));

                        var index = 0, //expectedSplits.length - 1,
                            numberOfNewFiles = 0;

                        stream.on('data', function(newFile){
                            numberOfNewFiles++;

                            should.exist(newFile);
                            should.exist(newFile.path);
                            should.exist(newFile.relative);
                            should.exist(newFile.contents);

                            var expectedSplitFile = expectedSplits[index];
                            newFile.relative.should.equal(path.basename(expectedSplitFile.path));

                            var contents = newFile.contents.toString('utf8');

                            contents.should.equal(expectedSplitFile.contents.toString('utf8'));
                            Buffer.isBuffer(newFile.contents).should.equal(true);
                            index++;
                        });

                        stream.on('end', function(){
                            numberOfNewFiles.should.equal(2);
                            done();
                        });

                        stream.write(longStylesheet);
                        stream.emit('end');
                    });
                });
            });
        });


        it("shouldn't add @imports if imports option is false", function(done){
            var stream = bless({
                imports: false
            });

            fs.readFile('./test/css/long.css', function(err, data){
                if(err) throw new Error(err);

                var longStylesheet = new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                    }),
                    expectedSplits = [];

                fs.readFile('./test/css/long-split--no-imports.css', function(err, data){
                    if(err) throw new Error(err);

                    expectedSplits.push(new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/long-split.css",
                        contents: new Buffer(data)
                    }));

                    fs.readFile('./test/css/long-split-blessed1.css', function(err, data){
                        if(err) throw new Error(err);

                        expectedSplits.push(new File({
                            cwd: "/home/adam/",
                            base: "/home/adam/test",
                            path: "/home/adam/test/long-split-blessed1.css",
                            contents: new Buffer(data)
                        }));

                        var index = 0, //expectedSplits.length - 1,
                            numberOfNewFiles = 0;

                        stream.on('data', function(newFile){
                            numberOfNewFiles++;

                            should.exist(newFile);
                            should.exist(newFile.path);
                            should.exist(newFile.relative);
                            should.exist(newFile.contents);

                            var expectedSplitFile = expectedSplits[index];
                            newFile.relative.should.equal(path.basename(expectedSplitFile.path));

                            var contents = newFile.contents.toString('utf8').replace(/\?z=[0-9]+'\)/g, "?z=xxx')");

                            contents.should.equal(expectedSplitFile.contents.toString('utf8'));
                            Buffer.isBuffer(newFile.contents).should.equal(true);
                            index++;
                        });

                        stream.on('end', function(){
                            numberOfNewFiles.should.equal(2);
                            done();
                        });

                        stream.write(longStylesheet);
                        stream.emit('end');
                    });
                });
            });
        });


        it('should return empty file if empty files are passed', function(done){
            var stream = bless();

            var stylesheetA = new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("")
            });

            var stylesheetB = new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("")
            });

            var numberOfNewFiles = 0;

            stream.on('data', function(newFile){
                numberOfNewFiles++;
                should.exist(newFile);
                should.exist(newFile.path);
                should.exist(newFile.relative);
                should.exist(newFile.contents);

                newFile.relative.should.equal('file.css');
                newFile.contents.toString('utf8').should.equal('');
                Buffer.isBuffer(newFile.contents).should.equal(true);
            });

            stream.on('end', function(){
                numberOfNewFiles.should.equal(2);
                done();
            });

            stream.write(stylesheetA);
            stream.write(stylesheetB);
            stream.end();
        });


        it('should throw an error if stream is passed', function(done){
            var stream = bless();

            stream.on('error', function(err){
                err.plugin.should.equal('gulp-bless');
                err.message.should.equal('Streaming not supported');
                done();
            });

            stream.write(new File({
                path: 'a',
                base: 'a',
                cwd: 'a',
                contents: fs.createReadStream('./test/css/long.css')
            }));
            stream.end();
        });


        it("shouldn't throw error if options are passed", function(done){
            var stream = bless({
                hello: 'world'
            });
            var numberOfErrors = 0;

            stream.on('error', function(){
                numberOfErrors++
            });

            stream.on('end', function(){
               numberOfErrors.should.be.equal(0);
               done();
            });

            stream.write(new File({
                path: 'style.css',
                contents: new Buffer('p {color:red;}')
            }));
            stream.emit('end');
        });


        it("should work if file doesn't end with .css", function(done){
            var stream = bless();
            var fileContents = 'p {color:red}';
            var numberOfFiles = 0;
            var numberOfErrrors = 0;

            stream.on('error', function(){
                numberOfErrrors++;
            });

            stream.on('data', function(file){
                file.contents.toString().should.be.equal('p {\n  color: red;\n}');
                path.basename(file.path).should.be.equal('style.xml');
                numberOfFiles++;
            });

            stream.on('end', function(){
                numberOfErrrors.should.be.equal(0);
                numberOfFiles.should.be.equal(1);
                done();
            });

            stream.write(new File({
                base: '/test/',
                cwd: '/test/a/',
                path: '/test/a/style.xml',
                contents: new Buffer(fileContents)
            }));
            stream.emit('end');
        });


        it("should work if file doesn't contain an extension", function(done){
            var stream = bless();
            var fileContents = 'p {color:red}';
            var numberOfFiles = 0;
            var numberOfErrrors = 0;

            stream.on('error', function(){
                numberOfErrrors++;
            });

            stream.on('data', function(file){
                file.contents.toString().should.be.equal('p {\n  color: red;\n}');
                path.basename(file.path).should.be.equal('style');
                numberOfFiles++;
            });

            stream.on('end', function(){
                numberOfErrrors.should.be.equal(0);
                numberOfFiles.should.be.equal(1);
                done();
            });

            stream.write(new File({
                base: '/test/',
                cwd: '/test/a/',
                path: '/test/a/style',
                contents: new Buffer(fileContents)
            }));
            stream.emit('end');
        });


        it("shouldn't concatenate files", function(done){
            var stream = bless();
            var numberOfFiles = 0;
            var numberOfErrrors = 0;

            var fileA = new File({
                base: '/test/',
                cwd: '/test/a/',
                path: '/test/a/abc.css',
                contents: new Buffer('p {\n  color: red;\n}')
            });

            var fileB = new File({
                base: '/test/',
                cwd: '/test/a/',
                path: '/test/a/def.css',
                contents: new Buffer('a {\n  color: blue;\n}')
            });

            stream.on('error', function(){
                numberOfErrrors++;
            });

            stream.on('data', function(file){
                if(numberOfFiles){
                    file.contents.toString().should.be.equal(fileB.contents.toString());
                    file.path.should.be.equal(path.resolve(fileB.path));
                }
                else {
                    file.contents.toString().should.be.equal(fileA.contents.toString());
                    file.path.should.be.equal(path.resolve(fileA.path));
                }
                numberOfFiles++;
            });

            stream.on('end', function(){
                numberOfErrrors.should.be.equal(0);
                numberOfFiles.should.be.equal(2);
                done();
            });

            stream.write(fileA);
            stream.write(fileB);
            stream.emit('end');
        });


        it("should log using gulp-util when option is enabled", function(done){
            var gulpBless = mockrequire('../index', {
                'gulp-util': {
                    log: function(text){
                        text.should.equal('Found 1 selector, not splitting.');
                        done();
                    }
                }
            });

            var stream = gulpBless({
                log: true
            });

            stream.write(new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("a { color: red; }")
            }));

            stream.end();
        });

         it("should log file splitted for large css", function(done){
            var gulpBless = mockrequire('../index', {
                'gulp-util': {
                    log: function(text){
                        text.should.equal('Found 4096 selectors, splitting into 2 blessedFiles.');
                        done();
                    }
                }
            });

            var stream = gulpBless({
                log: true
            });
            fs.readFile('./test/css/long.css', function(err, data){
                if(err) throw new Error(err);

                stream.write(new File({
                    cwd: "/home/adam/",
                    base: "/home/adam/test",
                    path: "/home/adam/test/file.css",
                    contents: new Buffer(data)
                }));

                stream.end();
            });
        });



        it("should not log using gulp-util when option isn't true", function(done) {
            var gulpBless = mockrequire('../index', {
                'gulp-util': {
                    log: function (text) {
                        should.fail(null, null, "gulp-util.log shouldn't have been called");
                    }
                }
            });

            var stream = gulpBless();

            stream.on('data', function(){});
            stream.on('end', function(){
                done();
            });

            stream.write(new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("a { color: red; }")
            }));

            stream.end();
        });

        it('should split content into correct file in correct order (issue #25)', function(done){
            var stream = bless();

            fs.readFile('./test/css/issue-25-test.css', function(err, data){
                if(err) throw new Error(err);

                var longStylesheet = new File({
                        cwd: "/home/adam/",
                        base: "/home/adam/test",
                        path: "/home/adam/test/issue-25-test.css",
                        contents: new Buffer(data)
                    });
                var actualSplits = [];
                var expectedNumSplits = 3;

                stream.on('data', function(newFile) {
                    should.exist(newFile);
                    should.exist(newFile.path);
                    should.exist(newFile.relative);
                    should.exist(newFile.contents);
                    actualSplits.push(newFile);
                });

                var extractIndexes = function(split) {
                    var contentAsString = split.contents.toString('utf8');
                    var extractRegex = /\.item-([0-9]+)/g;
                    var matches;
                    var indexes = []; 
                    do {
                        matches = extractRegex.exec(contentAsString);
                        if (matches) {
                            indexes.push(parseInt(matches[1]));
                        }
                    } while(matches);

                    return indexes;
                }

                stream.on('end', function() {
                    actualSplits.length.should.equal(expectedNumSplits);
                    var firstPart = actualSplits[1];
                    var secondPart = actualSplits[2];
                    var thirdPart = actualSplits[0]; //this should be the file with the original name.

                    firstPart.path.should.endWith("/issue-25-test-blessed1.css");
                    secondPart.path.should.endWith("/issue-25-test-blessed2.css");
                    thirdPart.path.should.endWith("/issue-25-test.css");
                    
                    var firstPartIndexes = extractIndexes(firstPart);
                    var secondPartIndexes = extractIndexes(secondPart);
                    var thirdPartIndexes = extractIndexes(thirdPart);

                    firstPartIndexes.should.have.length(4095);
                    firstPartIndexes.should.matchEach(function(num) {num.should.be.within(1, 4095)});
                    secondPartIndexes.should.have.length(4095);
                    secondPartIndexes.should.matchEach(function(num) {num.should.be.within(4096, 8190)});
                    thirdPartIndexes.should.have.length(3810);
                    thirdPartIndexes.should.matchEach(function(num) {num.should.be.within(8191, 12000)});
                    
                    done();
                });

                stream.write(longStylesheet);
                stream.emit('end');
            });
        });
    });
});
