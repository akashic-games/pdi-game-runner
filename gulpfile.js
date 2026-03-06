"use strict";
const browserify = require("browserify");
const { dest, parallel, series, src } = require("gulp");
const del = require("del");
const source = require("vinyl-source-stream")
const path = require("path");
const { spawn } = require("child_process");
const jasmine = require("gulp-jasmine");
const tslint = require("gulp-tslint");

function clean() {
    return del(["build", "lib", "spec/lib"]); // del returns Promise
}

const compile = series(clean, function _compile(cb) {
    const cmd = spawn("npx", ["tsc", "-p", path.join(__dirname, "src")], {stdio: "inherit"});
    return cmd.on("close", cb);
});

const compileSpec = series(compile, function _compileSpec(cb) {
    const cmd = spawn("npx", ["tsc", "-p", path.join(__dirname, "spec/src")], {stdio: "inherit"});
    return cmd.on("close", cb);
});
compileSpec.displayName = "compile:spec";

const bundle = series(compile, function _bundle() {
    return browserify({
        entries: "lib/bootstrap.js",
        debug: process.env.NODE_ENV === "development"
    })
    .external("@akashic/pdi-common-impl")
    .external("@akashic/akashic-engine")
    .external("@akashic/game-driver")
    .bundle()
    .pipe(source("bootstrap.js"))
    .pipe(dest("build"));
});

const bundlePdiCommonImpl = series(compile, function _bundlePdiCommonImpl() {
    return browserify({
        debug: process.env.NODE_ENV === "development"
    })
    .require("./node_modules/@akashic/pdi-common-impl/lib/index.js", {expose: "@akashic/pdi-common-impl"})
    .bundle()
    .pipe(source("pdi-common-impl.js"))
    .pipe(dest("build"));
});

const copy = series(parallel(bundle, bundlePdiCommonImpl), function _copy() {
    return src(
        ["lib/entry.js", "node_modules/@akashic/game-driver/build/akashic-engine.js", "node_modules/@akashic/game-driver/build/game-driver.js"]
    ).pipe(dest("build"));
});

const lint = function() {
    return src("src/**/*.ts")
    .pipe(tslint())
    .pipe(tslint.report());
}

const test = series(compileSpec, function _test() {
    return src("spec/lib/**/*[sS]pec.js")
    .pipe(jasmine());
});

exports.copy = copy;
exports.lint = lint;
exports.test = test;
exports.default = copy;
