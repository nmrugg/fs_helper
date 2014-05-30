// jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, onevar:true, strict:true, undef:true, unused:strict, curly:true, node:true, evil:true

"use strict";

var crypto = require("crypto"),
    girdle = require("girdle"),
    fs = require("fs"),
    p = require("path");

function copy(orig_path, new_path, cb)
{
    var read_stream  = fs.createReadStream(orig_path),
        write_stream = fs.createWriteStream(new_path);
    
    function done(err)
    {
        /// Prevent double calls on errors and closing.
        if (cb) {
            cb(err);
            cb = null;
        }
    }
    
    read_stream.on("error",  done);
    write_stream.on("error", done);
    write_stream.on("close", done);
    
    read_stream.pipe(write_stream);
}

function exists(paths, cb)
{
    if (typeof paths === "string") {
        paths = [paths];
    }
    
    girdle.async_loop(paths, function ondone()
    {
        cb(true);
    }, function oneach(path, next)
    {
        fs.exists(path, function oncheck(exists)
        {
            if (exists) {
                next()
            } else {
                cb(false);
            }
        });
    });
}

function filesize(path, cb)
{
    fs.stat(path, function onstat(err, stats)
    {
        if (err) {
            cb(null);
        } else {
            cb(stats.size);
        }
    });
}

function is_dir(path, cb)
{
    fs.stat(path, function onstat(err, stats)
    {
        if (err) {
            cb(err);
        } else {
            cb(null, stats.isDirectory());
        }
    });
}

function dir_exists(path, cb)
{
    fs.exists(path, function onexists(exists)
    {
        if (!exists) {
            return cb(null, exists);
        }
        
        is_dir(path, function onres(err, dir)
        {
            if (err) {
                cb(err);
            } else if (dir) {
                cb(null, true);
            } else {
                cb({error: "File exists; not directory."});
            }
        });
    });
}

function make_path(path, cb)
{
    var parts = path.split(p.sep),
        path = "";
    
    girdle.async_loop(parts, cb, function onpart(part, next)
    {
        if (!part) {
            path = p.join(path, "/");
            return next();
        }
        path = p.join(path, part);
        make_dir_if_none(path, next);
    });
}


function make_dir_if_none(path, cb)
{
    dir_exists(path, function onres(err, exists)
    {
        if (err) {
            cb(err);
        } else if (exists) {
            cb();
        } else if (!exists) {
            fs.mkdir(path, cb);
        }
    });
}

function get_all_dirs(path, cb)
{
    var dirs = [];
    
    fs.readdir(path, function onread(err, files)
    {
        if (err) {
            throw err;
        }
        
        girdle.async_loop(files, function ondone()
        {
            cb(dirs);
        }, function oneach(file, next)
        {
            var new_path = p.join(path, file);
            
            is_dir(new_path, function onres(err, dir) {
                if (!err && dir) {
                    dirs[dirs.length] = new_path;
                }
                next();
            });
        });
    });
}

function get_all_files(path, cb)
{
    var just_files = [];
    
    fs.readdir(path, function onread(err, files)
    {
        if (err) {
            throw err;
        }
        
        girdle.async_loop(files, function ondone()
        {
            cb(just_files);
        }, function oneach(file, next)
        {
            var new_path = p.join(path, file);
            
            is_dir(new_path, function onres(err, dir) {
                if (!err && !dir) {
                    just_files[just_files.length] = new_path;
                }
                next();
            });
        });
    });
}

function read_JSON(path)
{
    return girdle.parse_json(fs.readFileSync(path, "utf8"));
}

function md5(path, cb)
{
    var hasher = crypto.createHash("md5"),
        read_stream = fs.ReadStream(path);
    
    console.log("Depreciated: Use .hash(path, [hash,] [enc,] cb)");
    
    read_stream.on("data", function ondata(data)
    {
        hasher.update(data);
    });
    
    read_stream.on("end", function onend()
    {
        cb(hasher.digest("hex"));
    });
}

function hash(path, hash, enc, cb)
{
    var hasher,
        read_stream = fs.ReadStream(path);
    
    if (typeof hash === "function") { /// Are hash and enc missing?
        cb = hash;
        hash = "md5";
        enc = "hex";
    } else if (typeof enc === "function") { /// Is enc missing?
        cb = enc;
        enc = "hex";
    }
    
    hasher = crypto.createHash(hash);
    
    read_stream.on("data", function ondata(data)
    {
        hasher.update(data);
    });
    
    read_stream.on("end", function onend()
    {
        cb(hasher.digest(enc));
    });
}

function rm_r(path, cb)
{
    is_dir(path, function onres(err, dir)
    {
        if (dir) {
            /// Delete everything in it.
            fs.readdir(path, function onread(err, files)
            {
                files.forEach(function oneach(file, i)
                {
                    files[i] = p.join(path, file);
                });
                
                girdle.async_loop(files, function ondel()
                {
                    fs.rmdir(path, cb)
                }, rm_r);
            });
        } else {
           fs.unlink(path, cb);
        }
    });
}

function realbase(path)
{
    return p.basename(path, p.extname(path));
}

module.exports = {
    copy: copy,
    dir_exists: dir_exists,
    exists: exists,
    filesize: filesize,
    fs: fs,
    get_all_dirs: get_all_dirs,
    get_all_files: get_all_files,
    hash: hash,
    is_dir: is_dir,
    make_dir_if_none: make_dir_if_none,
    make_path: make_path,
    md5: md5,
    read_JSON: read_JSON,
    realbase: realbase,
    rm_r: rm_r,
};
