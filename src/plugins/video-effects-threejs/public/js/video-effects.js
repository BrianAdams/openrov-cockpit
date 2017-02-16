(function (window, document, jQuery) { //The function wrapper prevents leaking variables to global space
  //'use strict'; //#disabled to make three.js compatible
  var THREE=window.THREE={REVISION:"84"};  //Be sure to update when changing versions

  // Setup the namespace for shaders to be added by other plugins at loadtime
  window.OROV = window.OROV || {};
  window.OROV.VideoEffects = window.OROV.VideoEffects || {};
  window.OROV.VideoEffects.shaders = window.OROV.VideoEffects.shaders || {};

  //This should probably be replaced with Brunch/webpack/requies....
  $.getScript('components/three.js/three.min.js',function(){
    var head = document.getElementsByTagName("head")[0];
    [
      'components/three.js-examples/examples/js/shaders/CopyShader.js',
      'components/three.js-examples/examples/js/postprocessing/EffectComposer.js',
      'components/three.js-examples/examples/js/postprocessing/MaskPass.js',
      'components/three.js-examples/examples/js/postprocessing/RenderPass.js',
      'components/three.js-examples/examples/js/postprocessing/ShaderPass.js',
    ].forEach(function(script){
      console.trace("Adding " + script);
      var js = document.createElement("script");
      js.type = "text/javascript";
      js.src = script;
      head.appendChild(js);    
    });
  });

  var VideoEffectsProcessor;

  //These lines register the Example object in a plugin namespace that makes
  //referencing the plugin easier when debugging.
  var plugins = namespace('plugins');
  plugins.VideoEffectsProcessor = VideoEffectsProcessor;

  VideoEffectsProcessor = function VideoEffectsProcessor(cockpit) {

    console.log('Loading VideoEffectsProcessor plugin in the browser.');

    //instance variables
    this.cockpit = cockpit;
    this.rov = cockpit.rov;
    this.removeCanvas = null;


    //Borrowed heavily from https://github.com/ninjadev/nin
    this.layers = [];
    this.startFrames = {}; 
    this.endFrames = {};
    this.activeLayers = [];
    this.lastUpdatedActiveLayers = -1;

    // for plugin management:
    this.Plugin_Meta = {
      name : 'VideoEffectsProcessor-threejs',   // for the settings
      viewName: 'Video Effects Processor',
      defaultEnabled: false
   };

  };

  //private functions and variables (hidden within the function, available via the closure)


  //Adding the public methods using prototype simply groups those methods
  //together outside the parent function definition for easier readability.

  //Called by the plugin-manager to enable a plugin
  VideoEffectsProcessor.prototype.enable = function enable() {
    this.startfilter();
  };

  //Called by the plugin-manager to disable a plugin
  VideoEffectsProcessor.prototype.disable = function disable() {
    this.stopfilter();
  };

  VideoEffectsProcessor.prototype.stopfilter = function stopfilter() {
    if (this.removeCanvas!=null){
      this.removeCanvas();
    }
  }

  VideoEffectsProcessor.prototype.resize = function resize() {
    for(var i = 0; i < this.layers.length; i++) {
      var layer = this.layers[i];
      layer.instance && layer.instance.resize && layer.instance.resize();
    }
  }

VideoEffectsProcessor.prototype.reset = function() {
  this.activeLayers = [];
  this.lastUpdatedActiveLayers = -1;
};

VideoEffectsProcessor.prototype.hardReset = function() {
  this.reset();
  this.layers = [];
  this.startFrames = {};
  this.endFrames = {};
};

VideoEffectsProcessor.prototype.rebuildEffectComposer = function() {
  this.demo.rebuildEffectComposer(this.activeLayers.map(function(el) {
    if (el.instance) {
      return el.instance.getEffectComposerPass();
    }
  }));
};


  VideoEffectsProcessor.prototype.update = function(frame) {
    for(var i = 0; i < this.activeLayers.length; i++) {
      var layer = this.activeLayers[i];
      layer.update(frame);
    }
  };

  VideoEffectsProcessor.prototype.render = function(renderer) {
    for(var i = 0; i < this.activeLayers.length; i++) {
      if (this.activeLayers[i].render) {
        this.activeLayers[i].render(renderer);
      }
    }
  };

  VideoEffectsProcessor.prototype.startfilter = function startfilter() {
    var self=this;

    if ((typeof(THREE) === 'undefined')
      || (typeof(THREE.RenderPass) === 'undefined')
      || (typeof(THREE.ShaderPass) === 'undefined')
      || (typeof(THREE.EffectComposer) === 'undefined')
      || (typeof(THREE.MaskPass) === 'undefined')
      || (typeof(THREE.CopyShader) === 'undefined')


      ){
      setTimeout(this.startfilter.bind(this),1000);
      return;
    }



    this.cockpit.withHistory.on('video.videoElementAvailable',function(video){
      var canvas = document.createElement("canvas");
      canvas.style.width='100%';
      canvas.style.height='100%';
      video.parentNode.insertBefore(canvas,video);
      self.removeCanvas=function(){
        video.parentNode.removeChild(canvas);
      }

      var cw = 1920;
      var ch = 1080;
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;

      var renderer = new THREE.WebGLRenderer({
          canvas: canvas
      });
      renderer.setClearColor(0x000000);
      var tmpScene = new THREE.Scene();

      // camera
      // These numbers include the dimenions for the visual plain split in half (16x9)
      var camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 1, 10);
      camera.position.set(0, 0, 5);
      tmpScene.add(camera);

      // video texture
      var videoImage = document.createElement('canvas');
      videoImage.width = canvas.width;
      videoImage.height = canvas.height;

      var videoImageContext = videoImage.getContext('2d');
      // background color if no video present
      videoImageContext.fillStyle = '#ff0000';
      videoImageContext.fillRect(0, 0, videoImage.width, videoImage.height);

      var videoTexture = new THREE.Texture(videoImage);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;

      var renderPass = new THREE.RenderPass(tmpScene, camera);

      var effectCopy = new THREE.ShaderPass(THREE.CopyShader);
      effectCopy.renderToScreen = true;

      var composer = new THREE.EffectComposer(renderer);
      composer.addPass(renderPass);
      var dynamicLayer = new window.OROV.VideoEffects.layers.colorCorrection({imageTexture:videoTexture});
      composer.addPass(dynamicLayer.getEffectComposerPass());
      self.activeLayers.push(dynamicLayer);

   //   window.OROV.VideoEffects.shaders.forEach(function(shaderDescription){
    //      composer.addPass(new THREE.ShaderPass(window.OROV.VideoEffects.shaders.ColorCorrection.shader));
   //   })
      //composer.addPass(edgeShader);
      composer.addPass(effectCopy);


      var videoMaterial = new THREE.MeshBasicMaterial({
          map: videoTexture,
          overdraw: true
      });
      var videoGeometry = new THREE.PlaneGeometry(16, 10);
      var videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
      videoMesh.position.set(0, 0, 0);
      tmpScene.add(videoMesh);


//      video.addEventListener('play', function(){
        videoImage.width = video.videoWidth;
        videoImage.height = video.videoHeight;
        renderFrame.call(self);
//      },false);
      var sw = canvas.width/8;
      var sh = canvas.height/8;
      
      var scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = sw;
      scaledCanvas.height = sh;
      var scaledimage = scaledCanvas.getContext('2d');
      function renderFrame() {
          var vw = video.videoWidth;
          var vh = video.videoHeight;
          if (vw>0 && (!video.paused || !video.ended)){

            if ((videoImage.width !== vw) ||
               (videoImage.height !== vh)){
                  videoImage.width = vw;
                  videoImage.height = vh;
               };

            videoImageContext.drawImage(video, 0, 0);
            //var x = videoImageContext.getImageData(0, 0, 200, 200);

            //Test to see if we can generate fast scalled images to potentially share
            //scaledimage.drawImage(videoImage,0,0,sw,sh,0,0,videoImage.width,videoImage.height);
            //var x = scaledimage.getImageData(0, 0, sw, sh);
            
            self.update();
            if (videoTexture) {
                videoTexture.needsUpdate = true;
            }
            composer.render();
            self.render(renderer);
          }
          if(self.isEnabled){
            requestAnimationFrame(renderFrame.bind(self));
          }
      }

    });
  };


  window.Cockpit.plugins.push(VideoEffectsProcessor);

}(window, document, $));
