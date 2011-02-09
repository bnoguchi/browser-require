var _ = require('underscore')
  , Set = require('data-structures-js/set')
  , xss = require('validator/xss');

console.log(Set);
console.log(xss);

$( function () {
 var str =  _.reduce( [1, 2, 3, 4], function (str, num) {
    str += num;
    return str;
  }, '');
  $('#answer').text(str);
});
