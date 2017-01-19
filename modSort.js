'use strict';

var log    = console.log;
var error  = console.error;

function objectArraySort (data, key, order, callback) {
  // log("data %s", jsonString(data));
  var num_a, num_b;

  try{

    if(order === 'asc'){
      num_a = 1;
      num_b = -1;
    }else if (order === 'desc'){
      num_a = -1;
      num_b = 1;
    }else{  //デフォは降順(DESC)
      num_a = -1;
      num_b = 1;
    }

    data.sort( function(a, b){
      var x = a[key];
      var y = b[key];
      if (x > y) return num_a;
      if (x < y) return num_b;
      return 0;
    });

    // log("data %s", jsonString(data));
    callback(null, data);

  } catch (e) {
    error("ObjectArraySort function Error.");
    error(e);
    callback('err', e);
  }
}
exports.ObjectArraySort = objectArraySort;

