'use strict';

function isEmpty(obj) {
		if ( typeof obj === "undefined" ) return true;
		if (Array.isArray(obj)) { if( typeof obj[0] === "undefined"  ) return true; } 
	   //console.log(obj);
	   if ( typeof obj === "undefined" ) return true;
	   if (obj == null) return true;
	   //console.log("obj.length : " + obj.length);
	   if (obj.length > 0)    return false;
	   if (obj.length === 0)  return true;
	   //console.log("Object.keys(obj).length : " + Object.keys(obj).length);
	   //if( Object.keys(obj).length > 0 ) return false;
		for (var key in obj) {
			if (hasOwnProperty.call(obj, key)) return false;
		}

	   return true;
}

module.exports = isEmpty;

