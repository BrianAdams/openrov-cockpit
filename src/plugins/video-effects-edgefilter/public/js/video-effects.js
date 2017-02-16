(function (window, document, jQuery) { //The function wrapper prevents leaking variables to global space
  // Setup the namespace for shaders to be added by other plugins at loadtime
  window.OROV = window.OROV || {};
  window.OROV.VideoEffects = window.OROV.VideoEffects || {};
  window.OROV.VideoEffects.shaders = window.OROV.VideoEffects.shaders || [];
  return;
  //This should probably be replaced with Brunch/webpack/requies....
  $.getScript('components/three.js/three.min.js',function(){
    $.getScript('components/three.js-examples/examples/js/shaders/EdgeShader.js', function(){
      window.OROV.VideoEffects.shaders.push({
        shader:THREE.EdgeShader,
        name:"Edge Filter"
      });
    })
  });
}(window, document, $));
