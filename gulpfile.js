"use strict";
var browserify = require("browserify");
var buffer = require("vinyl-buffer");
var gulp = require("gulp");
var gutil = require("gulp-util");
var del = require("del");
var tslint = require("gulp-tslint");
var shell = require("gulp-shell");
var jasmine = require("gulp-jasmine");
var source = require("vinyl-source-stream");
var sourcemaps = require("gulp-sourcemaps");
var path = require("path");

gulp.task("clean", function(cb) {
    return del(["build", "lib", "spec/lib"]);
});

gulp.task("compile", gulp.series("clean", shell.task("tsc -p " + path.join(__dirname, "src"))));
gulp.task("compile:spec", gulp.series("clean", "compile", shell.task("tsc -p " + path.join(__dirname, "spec/src"))));

gulp.task("bundle", gulp.series("compile", function() {
    var b = browserify({
        entries: "lib/bootstrap.js",
        debug: "true"
    });
    b.external("@akashic/akashic-engine")
        .external("@akashic/game-driver");
    return b.bundle()
        .pipe(source("bootstrap.js"))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .on("error", gutil.log)
        .pipe(sourcemaps.write("./"))
        .pipe(gulp.dest("build"));
}));

gulp.task("copy", gulp.series("bundle", function() {
    return gulp.src(
        ["lib/entry.js", "node_modules/@akashic/game-driver/build/akashic-engine.js", "node_modules/@akashic/game-driver/build/game-driver.js"]
    ).pipe(gulp.dest("build"));
}));

gulp.task("lint", function(){
        return gulp.src("src/**/*.ts")
                .pipe(tslint())
                .pipe(tslint.report());
});

gulp.task("test", gulp.series("copy", "compile:spec", function() {
    return gulp.src("spec/lib/**/*[sS]pec.js")
        .pipe(jasmine());
}));

gulp.task("default", gulp.series("copy"));
