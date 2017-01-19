'use strict';
var ConfInc    = require('./Conf.json');
var memcConf   = ConfInc.Memcached;

var debug   = require('debug')('on');
debug.log   = console.log.bind(console);
var log     = console.log;
var argv    = require('argv');
var async   = require('async');
var fs      = require('fs');
var isEmpty = require('./isEmpty');
var modSort = require('./modSort');
var SCRIPT_NAME = ( process.argv[ 1 ] || '' ).split( '/' ).pop();
var Memcached = require('memcached')
Memcached.config.timeout = 10000;
Memcached.config.idle = 2000;
Memcached.config.poolSize = 1;
Memcached.config.retries = 20;
// var memcached = new Memcached( memcConf.server, memcConf.option );
var memcached = new Memcached( memcConf.server );

var DefTTL = memcConf.cacheTTL;
var STDIN;

if (process.stdin.isTTY) {
  main(); // memcached.js --input=xxxx or --file xxxx
} else {
  procStdin(); // case pipe stdin. curl http://xxxxx | node memcached.js
}

function main(){
  var params = {};

  argv.option( OptionSet() );
  var args = argv.run();

  if( Object.keys(args.options).length < 1  ) {
    argv.help();
    process.exit( 1 );
  }

  if( args.options.list ){
    memcacheList( function(err, data){
      if(!err) log(data);
    });
    return;
  }

  if( !isEmpty(args.options.get) ){
    var key = args.options.get
    if(key === 'true' )
      ErrPrint("--get option key none.", SCRIPT_NAME + " --get='KEY'", 1);

    memcacheGET(key, function(err, data){
      if(!err) {
        log("Key:" + this.key);
        if( isOBJ(data) === true ) log(JsonString(data));
        else log(data);
      }
    }.bind({key: key}));
    return;
  }

  if( args.options.check ){
    checkKeyValue(function(err){});
    return;
  }

  if( isEmpty(args.options.key) || args.options.key === 'true' ) {
    ErrPrint("--key none.", "help option " + SCRIPT_NAME + " -h", 1);
  }else{
    params.key = args.options.key;
  }

  if( STDIN ) {
    params.value = STDIN;
  }else if( !isEmpty(args.options.input)  ) {
    params.value = InputRead(args.options.input);
  }else if( !isEmpty(args.options.file)  ) {
    params.value = FileReadAsync(args.options.file);
  }else{
    ErrPrint("--input or --file not found.", null, 1);
  }

  if( isEmpty(args.options.set)  ) {
    testOut(params);
    return;
  }else{
    if( args.options.ttl ) DefTTL = args.options.ttl;
    // debug("args.options.ttl: %d", args.options.ttl);
    // debug("DefTTL: %s", DefTTL);
    memcacheSet(params, function(err){
      if(!err) log("SET: " + this.key);
      return;
    }.bind({key: params.key}));
  }

}

function isJSON(s){
  try {
    var obj = JSON.parse(s);
    return ture;
  } catch (e) {
    return false;
  }
}

function isOBJ(o){
  try {
    var json = JSON.stringify(o);
    return true;
  } catch (e) {
    console.error("isOBJ err, not change json")
    return false;
  }
}



function checkKeyValue(cb){

  async.waterfall([
    function(callback){
      memcacheList( function(err, arr){
        if(err || isEmpty(arr)){
          console.error("Error: memcache key list not found");
          return callback('err', null);
        }
        // log("memcacheList: %s", JsonString(arr));
        callback(null, arr);
      });
    },
    function(arr, callback){
      // log("memcacheList: %s", JsonString(arr));
      async.each(arr, function(obj, callback){
        // log("obj: %s", JsonString(obj));
        var key = obj['key'];
        // log("key: %s", key);
        try{
          memcached.get(key, function (err, data) {
            if(err) callback(err, "key: " + obj['key']);
            else if(data === null) callback("Value is null", "key: " + obj['key']);
            else {
              log("key : %s", key);
              log(data);
              callback(null, null);
            }
          });
        }catch(e){
          callback(e, "memcacheGET Miss.");
        }

      }, function(err, results){
        if(err){
          console.error(err);
          console.error(results);
        }
        memcached.end();
        callback();
      });
    }],
  function(err){
    if(err) console.log(err);
    cb(null);
  });

}

function testOut(params){
  var obj = {
    key: params.key,
    value: params.value
  };
  log(obj);
}


function DoJsonText(data){
  try {
    var obj = JSON.parse(data);
    return obj;
  } catch (e) {
    return data;
  }
}


function memcacheSet(params, callback){
  try{
    var key = params.key;
    var value = params.value;
    // debug("DefTTL: %s", DefTTL);
    memcached.set(key, value, DefTTL, function (err) {
      if(err) ErrPrint(err, "memcache key,value set Miss.", -1);
      callback(err);
      memcached.end();
    });
  }catch(e){
    ErrPrint(e, "memcacheSet set Miss.", 1);
    callback(e);
    memcached.end();
  }
}

function memcacheGET(key, callback){
  try{
    memcached.get(key, function (err, data) {
      if(err) ErrPrint(err, "memcache Miss hit.", -1);
      if(typeof data === 'undefined') data = null;
      callback(err, data);
      memcached.end();
    });
  }catch(e){
    ErrPrint(e, "memcacheGET Miss.", 1);
    callback(e, null);
    memcached.end();
  }
}

function memcacheList( callback ){
  var Dumps = [];
  var count = 0;
  memcached.items( function( err, result ){
    if( err ) ErrPrint(err, "memcache List Miss.", -1);

    async.each( result, function( itemSet, done ){
      debug("itemSet: %s", JsonString(itemSet));
      var keys = Object.keys( itemSet );
      keys.pop(); // we don't need the "server" key, but the other indicate the slab id's
      async.each( keys, function( stats , next ){
        debug("stats: %s", JsonString(stats));
        count++;
        //log("itemSet.server : " + itemSet.server);
        debug({stats: stats, number: itemSet[stats].number});
        if( typeof itemSet[stats].number === 'undefined') {

          next(null);

        } else {

          memcached.cachedump( itemSet.server, Number(stats), itemSet[stats].number, function( err, response ){
            if(err) {
              var msg = {
                msg: "Error memcached.cachedump",
                err: err,
                stats: Number(stats),
                itemSet: itemSet
              };
              console.error(JsonString(msg));
              Close(null);
            } else {
              debug("stats: %s", stats);
              debug("itemSet[stats].number: %s", itemSet[stats].number);
              debug("response: %s", JsonString(response));
              Close(response);
            }
            next(null);
          });

        }
      },function(err){
        done(null);
      });
    });
  });

  function Close(data){
    if(!isEmpty(data)) {
      if(Array.isArray(data)) var Items = data.slice(0);
      else var Items = [ data ];

      var len = Items.length;
      for(var i=0; i<len; i++){
        if(Items[i]) Dumps.push({key: Items[i].key});
      }
    }
    if(--count === 0){
      memcached.end();
      modSort.ObjectArraySort(Dumps, 'key', 'asc', function(err, data){
        callback(null, data);
      });
    }
  }

  function ItemGET(key, callback){
    try{
      memcached.get(key, function (err, data) {
        if(err) ErrPrint(err, "memcache Miss hit.", -1);
        if(typeof data === 'undefined') data = null;
        callback(err, data);
      });
    }catch(e){
      ErrPrint(e, "memcacheGET Miss.", 1);
      callback(e, null);
    }
  }


}

function procStdin(){
  async.series([

    function(callback){
      var data = '';

      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function(chunk){
        data += chunk;
      });
      process.stdin.on('end', function(){
        if (isEmpty(data)) callback;
        else { STDIN = data; callback(); }
      });
    },

    function(callback){
      callback(); main();
    }

  ]);
}

function InputRead(input){
  if(input === 'true') ErrPrint("--input not found.", null, 1);
  else return input;
}

function FileReadAsync(filename){
  var file;
  if(filename === 'true'){
    ErrPrint("Error: --file " + filename + " not found.", null, 1);
  }else{
    try{
      file = fs.readFileSync( filename, 'UTF-8' );
      if(file == null)
        ErrPrint("--file " + filename + ". Data is null.", null, 1);
    }catch(e){
      ErrPrint("file not found. " + filename, null, 1);
    }

  }
  return file;
}

function ErrPrint(err, msg, e){
  if(err) log("Error:" + err);
  if(msg) log(msg);
  if(e > -1) process.exit( e );
}

function OptionSet(){
  var option = [
    {
      name: 'check',
      short: 'c',
      type : 'boolean',
      description :'memcache key list all check',
      example: "cat JSON_FILE | " + SCRIPT_NAME + " --check or " + SCRIPT_NAME + " -c  < INPUT_JSON"
    },
    {
      name: 'key',
      short: 'k',
      type : 'string',
      description :'memcache key name',
      example: SCRIPT_NAME + " --key='text' or " + SCRIPT_NAME + " -k 'text'"
    },
    {
      name: 'input',
      short: 'i',
      type : 'string',
      description :'memocache value input text',
      example: SCRIPT_NAME + " --input='text' or " + SCRIPT_NAME + " -i 'text'"
    },
    {
      name: 'file',
      short: 'f',
      type : 'string',
      description :'memocache value input file',
      example: SCRIPT_NAME + " --file='FILE_PATH' or " + SCRIPT_NAME + " -i 'FILE_PATH'"
    },
    {
      name: 'set',
      short: 's',
      type : 'string',
      description :'memocache set key,value',
      example: SCRIPT_NAME + "--set --key='KEY' --input='text'"
    },
    {
      name: 'get',
      short: 'g',
      type : 'string',
      description :'memocache get value',
      example: SCRIPT_NAME + " --get='KEY' or " + SCRIPT_NAME + " -g 'KEY'"
    },
    {
      name: 'ttl',
      short: 't',
      type : 'int',
      description :'memocache set TTL. Defualt TTL = ' + DefTTL,
      example: SCRIPT_NAME + " --TTL=60 or " + SCRIPT_NAME + " -t 60"
    },
    {
      name: 'list',
      short: 'l',
      type : 'string',
      description :'memocache stats items',
      example: SCRIPT_NAME + " --list or -l"
    }
  ];

  return option;
}

function JsonLog(obj){
  return log(JsonString(obj));
}

function JsonString(obj) {
  return JSON.stringify(obj, null, "    ");
}

