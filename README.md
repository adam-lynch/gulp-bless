gulp-bless 
==========

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Windows Build Status][appveyor-image]][appveyor-url] [![Dependency Status][depstat-image]][depstat-url] 

---

Gulp plugin which splits CSS files suitably for Internet Explorer &lt; 10.

This is the a [Gulp](http://github.com/gulpjs/gulp) wrapper around [bless.js](https://github.com/paulyoung/bless.js) (see [blesscss.com](http://blesscss.com/)).

# Installation

```js
npm install gulp-bless
```

# Usage

```js
var gulp = require('gulp');
var bless = require('gulp-bless');

gulp.task('css', function() {
    gulp.src('style.css')
        .pipe(bless())
        .pipe(gulp.dest('./splitCSS'));
});

gulp.task('default', ['watch']);

// Rerun the task when a file changes
gulp.task('watch', function () {
  gulp.watch('./css/*.css', ['css']);
});
```

## bless(options).


- `imports` - A boolean (which defaults to `true`). Determines whether or not the first chunk / "blessed" file `@import`s the others.
- `cacheBuster` - A boolean (which defaults to `true`). If `imports` is `true`, this will add a random query parameter value to prevent against aggressive caching.
- `log` - A boolean (which defaults to `false`). Logs a small bit of information about the process.
- `partLabel` - A string (which defaults to `-blessed`). The label to used for splitted out part files. For example, with default the file name will be "long-blessed1.css"; with value of `part`, the file name will be "long-part1.css".

Example:

```javascript
gulp.src('long.css')
        .pipe(bless({
            imports: false
        }))
        .pipe(gulp.dest('./'))
```

## About minification

You should minify your CSS *after* it goes through gulp-bless. See [BlessCSS/bless#90](https://github.com/BlessCSS/bless/issues/90) as to why.


# Does this support sourcemaps?

Yes. This can be used with [gulp-sourcemaps](https://www.npmjs.com/package/gulp-sourcemaps).



[npm-url]: https://npmjs.org/package/gulp-bless
[npm-image]: http://img.shields.io/npm/v/gulp-bless.svg?style=flat

[travis-url]: http://travis-ci.org/BlessCSS/gulp-bless
[travis-image]: http://img.shields.io/travis/BlessCSS/gulp-bless.svg?style=flat

[appveyor-url]: https://ci.appveyor.com/project/BlessCSS/gulp-bless/branch/master
[appveyor-image]: https://ci.appveyor.com/api/projects/status/9hv1ts9fm2g8d6rj/branch/master?svg=true

[depstat-url]: https://david-dm.org/BlessCSS/gulp-bless
[depstat-image]: https://david-dm.org/BlessCSS/gulp-bless.svg?style=flat
