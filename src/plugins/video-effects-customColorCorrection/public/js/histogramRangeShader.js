(function(window, document, jQuery) { //The function wrapper prevents leaking variables to global space
    // Setup the namespace for shaders to be added by other plugins at loadtime
    window.OROV = window.OROV || {};
    window.OROV.VideoEffects = window.OROV.VideoEffects || {};
    window.OROV.VideoEffects.shaders = window.OROV.VideoEffects.shaders || {};

    var fragment = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D u_texture;

void main() {
  vec4 maxColor = vec4(0,0,0,0);
  
  // we know the texture is 256x1 so just go over the whole thing
  for (int i = 0; i < 256; ++i) {
    // compute centers of pixels
    vec2 uv = vec2((float(i) + 0.5) / 256.0, 0.5);
    
    // get max value of pixel
    maxColor = max(maxColor, texture2D(u_texture, uv));
  }
  
  gl_FragColor = maxColor;
}
`

 

    var vertex_org = `
attribute vec4 position;
void main() {
  gl_Position = position;
}
`

    var vertex = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`


    //This should probably be replaced with Brunch/webpack/requies....
    $.getScript('components/three.js/three.min.js', function() {
        var uniforms = {
            "tDiffuse": {
                value: null
            },
            "aspect": {
                value: new THREE.Vector2(512, 512)
            },                   
        };

        window.OROV.VideoEffects.shaders.HistogramRange= {
            shader: {
                fragmentShader: fragment,
                vertexShader: vertex,
                uniforms: uniforms
            },
            name: "Histogram"
        }
    });
}(window, document, $));