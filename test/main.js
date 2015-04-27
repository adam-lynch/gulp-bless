var mockrequire = require('proxyquire');

var bless = require('../');
var should = require('should');
var fs = require('fs');
var path = require('path');
var File = require('gulp-util').File;
var Buffer = require('buffer').Buffer;

describe('gulp-bless', function() {
    describe('bless()', function() {

        it("should use bless.js' defaults when options aren't passed", function(done){
            var gulpBless = mockrequire('../index', {
                bless: {
                    Parser: function(args){
                        var options = args.options;

                        options.should.be.type('object');
                        options.should.have.property('cacheBuster', true);
                        options.should.have.property('cleanup', true);
                        options.should.have.property('compress', false);
                        options.should.have.property('force', false);
                        options.should.have.property('imports', true);

                        done();
                        var originalBless = require('bless');
                        return new originalBless.Parser(args);
                    }
                }
            });

            var stream = gulpBless();

            stream.write(new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("non-empty")
            }));

            stream.end();
        });

        it("should use some bless.js' defaults when some options are missing", function(done){
            var gulpBless = mockrequire('../index', {
                bless: {
                    Parser: function(args){
                        var options = args.options;

                        options.should.be.type('object');
                        options.should.have.property('cacheBuster', false);
                        options.should.have.property('cleanup', true);
                        options.should.have.property('compress', false);
                        options.should.have.property('force', false);
                        options.should.have.property('imports', true);
                        options.should.not.have.property('log');

                        done();
                        var originalBless = require('bless');
                        return new originalBless.Parser(args);
                    }
                }
            });

            var stream = gulpBless({
                cacheBuster: false
            });

            stream.write(new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("non-empty")
            }));

            stream.end();
        });

        it("shouldn't pass log or exclude option to bless", function(done){
            var gulpBless = mockrequire('../index', {
                bless: {
                    Parser: function(args){
                        var options = args.options;

                        options.should.be.type('object');
                        options.should.not.have.property('log');
                        options.should.not.have.property('exclude');

                        done();
                        var originalBless = require('bless');
                        return new originalBless.Parser(args);
                    }
                }
            });

            var stream = gulpBless({
                log: false,
                exclude: 'nothing'
            });

            stream.write(new File({
                cwd: "/home/adam/",
                base: "/home/adam/test",
                path: "/home/adam/test/file.css",
                contents: new Buffer("non-empty")
            }));

            stream.end();
        });

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
                newFile.contents.toString('utf8').should.equal('p {color:red}');
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
            stream.end();
        });

        it('should not process excluded files', function(done){
            var stream = bless({exclude: '**/*.css'}),
                numberOfNewFiles = 0;

            fs.readFile('./test/css/long.css', function(err, data){
                if(err) throw new Error(err);

                stream.on('data', function(newFile){
                    numberOfNewFiles++;
                    newFile.contents.toString('utf8').should.equal(data.toString('utf8'));
                });

                stream.on('end', function(){
                    numberOfNewFiles.should.equal(1);
                    done();
                });

                stream.write(new File({
                    cwd: "/home/adam/",
                    base: "/home/adam/test",
                    path: "/home/adam/test/file.css",
                    contents: new Buffer(data)
                }));
                stream.end();
            });
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

                        var index = expectedSplits.length - 1,
                            numberOfNewFiles = 0;

                        stream.on('data', function(newFile){
                            numberOfNewFiles++;

                            should.exist(newFile);
                            should.exist(newFile.path);
                            should.exist(newFile.relative);
                            should.exist(newFile.contents);

                            var expectedSplitFile = expectedSplits[index];
                            newFile.relative.should.equal(path.basename(expectedSplitFile.path));

                            var contents = newFile.contents.toString('utf8').replace(/\?z=.*?'\)/g, "?z=xxx')");
                            contents.should.equal(expectedSplitFile.contents.toString('utf8'));
                            Buffer.isBuffer(newFile.contents).should.equal(true);
                            index--;
                        });

                        stream.on('end', function(){
                            numberOfNewFiles.should.equal(2);
                            done();
                        });

                        stream.write(longStylesheet);
                        stream.end();
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
                file.contents.toString().should.be.equal(fileContents);
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
            stream.end();
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
                file.contents.toString().should.be.equal(fileContents);
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
            stream.end();
        });

        it("shouldn't concatenate files", function(done){
            var stream = bless();
            var numberOfFiles = 0;
            var numberOfErrrors = 0;

            var fileA = new File({
                base: '/test/',
                cwd: '/test/a/',
                path: '/test/a/abc.css',
                contents: new Buffer('aaa')
            });

            var fileB = new File({
                base: '/test/',
                cwd: '/test/a/',
                path: '/test/a/def.css',
                contents: new Buffer('bbb')
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
            stream.end();
        });

        it("should log using gulp-util when option is enabled", function(done){
            var gulpBless = mockrequire('../index', {
                'gulp-util': {
                    log: function(text){
                        text.should.equal('Found 0 selectors, not splitting.');
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
                contents: new Buffer("non-empty")
            }));

            stream.end();
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
                contents: new Buffer("non-empty")
            }));

            stream.end();
        });
    });
});