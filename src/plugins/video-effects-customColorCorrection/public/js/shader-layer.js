(function(window,document,Jquery) {
window.OROV = window.OROV || {};
window.OROV.VideoEffects = window.OROV.VideoEffects || {};
window.OROV.VideoEffects.layers = window.OROV.VideoEffects.layers || [];
/* Module level closure variables */
arrayLength = 0;

/**
 * @constructor
 */
function ShaderLayer(renderer,scene,config) {
  this.config = config;
  this.shaderPass = new THREE.ShaderPass(window.OROV.VideoEffects.shaders.ColorCorrection.shader);
  this.histogramCanvas = null;
  this.renderer = renderer;
  this.scene = scene;

    var colorBalanceParams = function() {
        this.message = "Color Balance Parameters";
        this.percentage = 1.0;
        this.enable = false;
    };
    var self=this;
    this.params = new colorBalanceParams();  
    new THREE.TextureLoader().load("plugin/video-effects-customColorCorrection/js/test.png",function(texture){
        self.mockImage = texture;
        self.initHistogramScene();  
    } );

}


function getMockHistogramTexture(){
    var dummyRGBA = new Uint8Array(256*4);
    for(var i=0;i<255*4;i=i+4){
        //dummyRGBA[i]=Math.ceil(Math.random() * 255);
        dummyRGBA[i]=Math.ceil(Math.random() * 255)
        dummyRGBA[i+1]=Math.ceil(Math.random() * 255)
        dummyRGBA[i+2]=Math.ceil(Math.random() * 255)
        dummyRGBA[i+3]=1;
    }
    //https://threejs.org/docs/api/textures/DataTexture.html
    var t = new THREE.DataTexture(dummyRGBA, 256,1, THREE.RGBA,THREE.Float);
    t.needsUpdate = true;
    return t;
}

function getMockMaxColorTexture(){
    var dummyRGBA = new Uint8Array(4);
    dummyRGBA[0]=0;
    dummyRGBA[1]=255;
    dummyRGBA[2]=255;
    dummyRGBA[3]=255;

//    dummyRGBA = new Uint32Array(1);
//    dummyRGBA[1]=0xFFFFFFFF;
    
    //https://threejs.org/docs/api/textures/DataTexture.html
    var t =  new THREE.DataTexture(dummyRGBA, 1,1, THREE.RGBA)//, THREE.FloatType);
    t.needsUpdate = true;
    return t;
}

function createRTTScene(width,height,shader,options){
    var scene = new THREE.Scene();

    // you may need to modify these parameters
    var renderTargetParams = {
    stencilBuffer:false,
    depthBuffer:false,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter
    };

    // create buffer
    var renderTarget = new THREE.WebGLRenderTarget( width, height, renderTargetParams);
    if (options == undefined){
        options = {};
    }

    var material = new THREE.ShaderMaterial(
        shader
    );

    // Setup render-to-texture scene
    var camera = new THREE.OrthographicCamera( width / - 2,
    width / 2,
    height / 2,
    height / - 2, -10000, 10000 );

    var geometry;
    if (options.bufferGeometry){
        geometry = new THREE.BufferGeometry();
    } else {
        geometry = new THREE.PlaneGeometry( options.geometryWidth ? options.geometryWidth : width, options.geometryHeight ? options.geometryHeight : height );
    }
    geometry.verticesNeedUpdate=true;
    var mesh;
    if (options.points){
        mesh = new THREE.Points( geometry, material);
    } else {
        mesh = new THREE.Mesh( geometry, material);
    }
    mesh.position.set(0, 0, 0);
    scene.add( mesh );
    return {shader: shader,scene:scene,texture:renderTarget.texture,renderTarget:renderTarget,material:material,geometry:geometry,mesh:mesh, camera:camera};
    
}

// TODO: Try putting everything in the same canvas context and then using "viewports" in three js to display the histogram.  Rumor has it we cannot share textures (the video image) across contexts.
// Short term we could clone the image for now? Make sure everything else is working.
ShaderLayer.prototype.initHistogramScene = function () {
   /* Before every frame we need to generate the Histogram in to a texture that can be fed in to the next render
    * http://stackoverflow.com/questions/37527102/how-do-you-compute-a-histogram-in-webgl
   */
    var self=this;
 //   var canvas= document.createElement("canvas");
    var mockHistogramTexture = getMockHistogramTexture();
    var mockMaxColorTexture = getMockMaxColorTexture();
 //   canvas.width = this.config.imageTexture.image.width;
 //   canvas.height = this.config.imageTexture.image.height;;

 //   var renderer = new THREE.WebGLRenderer({
 //       canvas: canvas
 //   });
 //   renderer.setClearColor(0x000000);
  
    /* Setup the historgram texture */

    //var myImage = this.mockImage;
    var myImage = this.config.imageTexture;

    var imageWidth = myImage.image.videoWidth? myImage.image.videoWidth :myImage.image.width;
    var imageHeight = myImage.image.videoHeight? myImage.image.videoHeight:myImage.image.height;
    var loader = new THREE.TextureLoader();

    var hisogramShader = window.OROV.VideoEffects.shaders.Histogram.shader;

    hisogramShader.uniforms.u_texture =  { type: "t", value: myImage };
    hisogramShader.uniforms.u_colorMult = { type: "v4", value: new THREE.Vector4(0,0,0,0)}; //TODO: Have to call for each channel //vec4
    hisogramShader.uniforms.u_resolution = {type: "v2", value: new THREE.Vector2(imageWidth,imageHeight)}; //vec2

    var hisogramRTT = createRTTScene(256,1,hisogramShader,{bufferGeometry:true,points:true});
    console.log("Historgram Texture UUID:",hisogramRTT.texture.uuid);
 //   hisogramRTT.material.blending = THREE.AdditiveBlending;
   hisogramRTT.material.blending = THREE.CustomBlending;//THREE.AdditiveBlending;
    hisogramRTT.material.blendEquation = THREE.AddEquation;
    hisogramRTT.material.blendSrc = THREE.ONE_FACTOR;
    hisogramRTT.material.blendDst = THREE.ONE_FACTOR;
    hisogramRTT.material.depthTest=false;
    hisogramRTT.material.depthWrite=false;
    hisogramRTT.material.needsUpdate = true;
  //  hisogramRTT.material.transparent = true;

/*
    for (var x = 0; x< imageWidth; x++){
        for (var y=0; y< imageHeight; y++){
            var vert = new THREE.Vector3();
            vert.x = x;
            vert.y = y;
            vert.z = 0;
            hisogramRTT.geometry.vertices.push(vert);
        }
    }
*/        

    var numPixels = imageHeight*imageWidth;

    var vertexs = new Float32Array(numPixels*3);
    var pixelsIds = new Float32Array(numPixels);

    for (var i = 0; i < vertexs.length; i=i+3) {
        vertexs[i]=(i/3)%imageWidth-(imageWidth/2);
        vertexs[i+1]=Math.floor((i/3)/imageWidth)-(imageHeight/2);
        vertexs[i+2]=0;
        pixelsIds[(i/3)]=[(i/3)];
        //vec2(mod(position, u_resolution.x), floor(position / u_resolution.x));

    }
    hisogramRTT.geometry.addAttribute('position', new THREE.BufferAttribute(vertexs,3));
    hisogramRTT.geometry.addAttribute('pixelId', new THREE.BufferAttribute(pixelsIds,1));


    hisogramRTT.geometry.dynamic = true;
//    hisogramRTT.geometry.computeBoundingSphere();
    hisogramRTT.geometry.computeBoundingBox();
    //hisogramRTT.geometry.attributes.position.needsUpdate = true;

   /* Setup the maxColor texture */
   
    var maxColorShader = window.OROV.VideoEffects.shaders.HistogramRange.shader;
    maxColorShader.uniforms.u_texture = { type: "t", value:hisogramRTT.texture};
    //maxColorShader.uniforms.u_texture = { type: "t", mockHistogramTexture};
    var maxColorTextureMat = new THREE.ShaderMaterial(
        maxColorShader
    );
    var maxColorRTT = createRTTScene(1,1,maxColorShader);
    console.log("maxColorRTT Texture UUID:",maxColorRTT.texture.uuid);
    /*
    * Setup the scene for rendering the  to a new HTML cancas jus
    */
    var histogramcamera = new THREE.OrthographicCamera(-8, 8, 5, -5, 1, 10);
      histogramcamera.position.set(0, 0, 5);

    /*
    var histogramDisplayCanvas = document.createElement("canvas");
    histogramDisplayCanvas.width=255;
    histogramDisplayCanvas.height=100;
    
    document.body.appendChild(histogramDisplayCanvas);
    histogramDisplayCanvas.style="position:absolute;left:0;top:0;z-index:9999"
    this.histogramCanvas=histogramDisplayCanvas; 
    */

    var histogramDisplayScene = new THREE.Scene();
        window.scene=histogramDisplayScene;
 /*   var renderer = new THREE.WebGLRenderer({
        canvas: histogramDisplayCanvas
    });
    renderer.setClearColor(0x00000000);    //Salmon color
    renderer.autoClear = false;
*/
    // you may need to modify these parameters
    var renderTargetParams = {
    minFilter:THREE.LinearFilter,
    stencilBuffer:false,
    depthBuffer:false
    };

    var histogramTexture = new THREE.WebGLRenderTarget( 255, 100, renderTargetParams);
    var histogramShader = window.OROV.VideoEffects.shaders.HistogramVisualizer.shader;
   

   
    histogramShader.uniforms.u_histTexture = {type: "t", value:hisogramRTT.texture};
    //histogramShader.uniforms.u_histTexture = {type: "t", value:mockHistogramTexture};
    
    histogramShader.uniforms.u_maxTexture = {type:"t", value:maxColorRTT.texture};
    //histogramShader.uniforms.u_maxTexture = {type: "t", value:mockMaxColorTexture};
    histogramShader.uniforms.u_resolution = {type: "v2", value: new THREE.Vector2(255,100)}; //vec2

    var histogramViewRTT = createRTTScene(255,100,histogramShader);
    console.log("histogramView Texture UUID:",histogramViewRTT.texture.uuid);
/*    
    var histogramTextureMat = new THREE.ShaderMaterial(
        histogramShader
    );
    var histogramTextureGeo = new THREE.PlaneGeometry(255, 100);
    histogramTextureMesh = new THREE.Mesh( histogramTextureGeo, histogramTextureMat );

    histogramTextureMesh.position.set(0, 0, 0);
    histogramDisplayScene.add( histogramTextureMesh);   


    var renderPass = new THREE.RenderPass(histogramDisplayScene, histogramcamera);

    var effectCopy = new THREE.ShaderPass(THREE.CopyShader);
    effectCopy.renderToScreen = true;

    var composer = new THREE.EffectComposer(this.renderer);
    composer.addPass(renderPass);
    composer.addPass(effectCopy);
*/

      var viewhistogramMaterial = new THREE.MeshBasicMaterial({
          map: histogramViewRTT.texture,
          overdraw: true
      });
      var viewhistogramGeometry = new THREE.PlaneGeometry(2.5, 1);
      var viewhistogramMesh = new THREE.Mesh(viewhistogramGeometry, viewhistogramMaterial);
      viewhistogramMesh.position.set(-7, 0, 1);
      viewhistogramMesh.rotation.y = (50 *Math.PI)/180;

      this.scene.add(viewhistogramMesh);


      var viewrawhistogramMaterial = new THREE.MeshBasicMaterial({
          map: hisogramRTT.texture,
          overdraw: true
      });
      var viewrawhistogramGeometry = new THREE.PlaneGeometry(2.5, .5);
      var viewrawhistogramMesh = new THREE.Mesh(viewrawhistogramGeometry, viewrawhistogramMaterial);
      viewrawhistogramMesh.position.set(-7, -1, 1);
      viewrawhistogramMesh.rotation.y = (50 *Math.PI)/180;

      this.scene.add(viewrawhistogramMesh);
          
      var imageMaterial = new THREE.MeshBasicMaterial({
          map:myImage,
          overdraw: true
      });
      var imageGeometry = new THREE.PlaneGeometry(2.5, 1);
      var imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
      imageMesh.position.set(-7, -2, 1);
      imageMesh.rotation.y = (50 *Math.PI)/180;

      this.scene.add(imageMesh);  

      var viewMaxColorMaterial = new THREE.MeshBasicMaterial({
          map:  maxColorRTT.texture,
          overdraw: true
      });
      var viewMaxColorGeometry = new THREE.PlaneGeometry(2.5, 1);
      var viewMaxColorMesh = new THREE.Mesh(viewMaxColorGeometry, viewMaxColorMaterial);
      viewMaxColorMesh.position.set(-7, -3, 1);
      viewMaxColorMesh.rotation.y = (50 *Math.PI)/180;

      this.scene.add(viewMaxColorMesh);         

    var buffer = new Float32Array(256*4);

 /*   this.renderer.state.buffers.color.setMask = function ( colorMask, masked ) {

		if ( currentColorMask !== colorMask && ! locked ) {
            if (masked) { 
			    gl.colorMask( colorMask&&0xFF000000, colorMask&&0x00FF0000, colorMask&&0x0000FF00, colorMask&&0x000000FF );
            } else {
			    gl.colorMask( colorMask, colorMask, colorMask, colorMask );                
            }
            currentColorMask = colorMask;

		}

	};
    */
    //TODO: Add an offscrene renderer?
    var frames = 0;
    var activationframes = 0
    var gl = self.renderer.getContext();
    var o_setMask = this.renderer.state.buffers.color.setMask;
    this.renderHistogram=function(){
        if (activationframes < 3){
            activationframes++;
            return;
        }
        activationframes=0;
      //  o_autoClear = self.renderer.autoClear;
      //  self.renderer.autoClear = false;

//        var o_sortObjects = this.renderer.sortObjects;
        //self.renderer.sortObjects=true;

        gl.blendFunc(gl.ONE, gl.ONE);
        gl.enable(gl.BLEND);
        
        this.renderer.state.buffers.color.setMask = function(){}; //disable threejs state mgt of color mask
        for (var channel = 0; channel < 4; ++channel) {
 /*           this.renderer.state.buffers.color.setMask = function(){
                gl.colorMask(channel === 0, channel === 1, channel === 2, channel === 3);
            
            }
        */
        gl.colorMask(channel === 0, channel === 1, channel === 2, channel === 3);
        self.renderer.state.buffers.color.setMask(false);
        self.renderer.state.buffers.color.setMask(true);                        
            hisogramRTT.material.uniforms.u_colorMult.value =  new THREE.Vector4(
                channel === 0 ? 1 : 0, 
                channel === 1 ? 1 : 0, 
                channel === 2 ? 1 : 0, 
                channel === 3 ? 1 : 0, 
            );
            hisogramRTT.material.uniforms.u_colorMult.needsUpdate = true;          
            self.renderer.render( hisogramRTT.scene, hisogramRTT.camera, hisogramRTT.renderTarget, true );
        }
        gl.colorMask(1,1,1,1);
        self.renderer.state.buffers.color.setMask = o_setMask;
    //    self.renderer.state.buffers.color.setMask(false);
    //    self.renderer.state.buffers.color.setMask(true);
        gl.blendFunc(gl.ONE, gl.ZERO);    
        gl.disable(gl.BLEND);
        //this.renderer.state.setMask(false);

        //gl.colorMask(true, true, true, true);
        /* This appears to actually work */
        // var gl = renderer.getContext();
        // gl.readPixels( 0, 0, 255, 1, gl.RGBA, gl.FLOAT, buffer );      
        // debugger;

       
        
        self.renderer.render( maxColorRTT.scene, maxColorRTT.camera, maxColorRTT.renderTarget, true );
        self.renderer.render( histogramViewRTT.scene, histogramViewRTT.camera, histogramViewRTT.renderTarget, true );

        frames++;
        if (frames==30){
            self.renderer.readRenderTargetPixels(maxColorRTT.renderTarget, 0, 0, 1, 1, buffer);
            console.log(`Max Colors: R:${buffer[0]} G:${buffer[1]} B:${buffer[2]} A:${buffer[2]}`);
            //self.renderer.readRenderTargetPixels(hisogramRTT.renderTarget, 0, 0, 255, 1, buffer);
            frames=0;
        }


        /* composer.render(); */
      //  self.renderer.autoClear = o_autoClear;
      //  self.renderer.sortObjects = o_sortObjects;
        //TODO: Render histogram somewhere?
        return true;
    }
    
}

ShaderLayer.prototype.getEffectComposerPass = function() {
  return this.shaderPass;
};

ShaderLayer.prototype.start = function() {
  
};

/*
* For wrapping up
*/
ShaderLayer.prototype.end = function() {
};

/*
* update is called from the animation loop, once per frame before it renders
* frame is the ImageData object of the source image
*/
ShaderLayer.prototype.updateold = function(frame) {
   // this.shaderPass.uniforms.time.value = relativeFrame;
    var constants = getRGBConstants(frame.data,this.params);
    arrayLength = frame.data.length;
    this.shaderPass.uniforms.u_redHigh.value = constants.red.h;
    this.shaderPass.uniforms.u_redLow.value = constants.red.l;
    this.shaderPass.uniforms.u_blueHigh.value = constants.blue.h;
    this.shaderPass.uniforms.u_blueLow.value = constants.blue.l;
    this.shaderPass.uniforms.u_greenHigh.value = constants.green.h;
    this.shaderPass.uniforms.u_greenLow.value = constants.green.l;   
};

ShaderLayer.prototype.update = function(renderer) {
    if (!this.renderHistogram){
        return;
    }
    var r = this.renderHistogram();

    //console.dir(this.histogramImage);
    //If the magic happened, I have a bitarry of integers that represent the value of each bin
    return;
    debugger;
    this.shaderPass.uniforms.u_redHigh.value = constants.red.h;
    this.shaderPass.uniforms.u_redLow.value = constants.red.l;
    this.shaderPass.uniforms.u_blueHigh.value = constants.blue.h;
    this.shaderPass.uniforms.u_blueLow.value = constants.blue.l;
    this.shaderPass.uniforms.u_greenHigh.value = constants.green.h;
    this.shaderPass.uniforms.u_greenLow.value = constants.green.l;   
};

/*
* update is called when the video size changes
*/
ShaderLayer.prototype.resize = function() {
};

/*
* update is called from the animation loop, after the scene has rendered
*/
ShaderLayer.prototype.render = function(renderer) {
};

function getRGBConstants(data,params){

    return  {
        red: {b: 1, l: 0, h: 1},
        blue: {b: 1, l: 0, h: 1},
        green: {b: 1, l: 0, h: 1}
    }

    //Set percentages
    var percent = params.percentage;
    var halfPercent = percent / 200.0;
    redHist = new Float32Array(256);
    greenHist = new Float32Array(256);
    blueHist = new Float32Array(256);
    //Fill up the histograms
    // var t0 = performance.now();
    for(var i = 0; i < data.length; i += 40) {
        ++redHist[data[i]];
        ++greenHist[data[i+1]];
        ++blueHist[data[i+2]];
    }
    // var t1 = performance.now();
    // console.log("Call to doSomething took " + (t1 - t0) + " milliseconds.");
    
    //Get our constants
    var red = calculateColorBalanceParams(redHist, halfPercent);
    var green = calculateColorBalanceParams(greenHist, halfPercent);
    var blue = calculateColorBalanceParams(blueHist, halfPercent);

    return {red: red, green:green, blue,blue};     
}

function calculateColorBalanceParams(hist, percent) {
            
    var lowTarget = Math.floor(arrayLength * percent);
    var lowAcc = 0;
    var lowIndex = 0;
    while(lowAcc <= lowTarget) {
        lowAcc = lowAcc + hist[lowIndex];
        lowIndex = lowIndex + 1;
    }
    lowIndex = lowIndex - 1;
    
    // //Calculate high value
    var highTarget = Math.ceil(arrayLength*(1.0-percent));
    var highAcc = arrayLength;
    var highIndex = 255;
    while(highAcc >= highTarget) {
        highAcc = highAcc - hist[highIndex];
        highIndex = highIndex - 1;
    }
    highIndex = highIndex + 1;
    var beta = (255 - 0)/(highIndex - lowIndex);
    return {b: beta, l: lowIndex/255.0, h: highIndex/255.0};
}

window.OROV.VideoEffects.layers.colorCorrection = ShaderLayer;
}(window, document, $));