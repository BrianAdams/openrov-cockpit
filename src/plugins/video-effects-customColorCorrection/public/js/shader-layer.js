(function(window,document,Jquery) {
window.OROV = window.OROV || {};
window.OROV.VideoEffects = window.OROV.VideoEffects || {};
window.OROV.VideoEffects.layers = window.OROV.VideoEffects.layers || [];
/* Module level closure variables */
arrayLength = 0;

/**
 * @constructor
 */
function ShaderLayer(config) {
  this.config = config;
  this.shaderPass = new THREE.ShaderPass(window.OROV.VideoEffects.shaders.ColorCorrection.shader);


    var colorBalanceParams = function() {
        this.message = "Color Balance Parameters";
        this.percentage = 1.0;
        this.enable = false;
    };
    this.params = new colorBalanceParams();  

    this.initHistogramScene();  
}


ShaderLayer.prototype.initHistogramScene = function () {
   /* Before every frame we need to generate the Histogram in to a texture that can be fed in to the next render
   */

    var canvas= document.createElement("canvas");

    canvas.width = this.config.imageTexture.image.width;
    canvas.height = this.config.imageTexture.image.height;;

    var renderer = new THREE.WebGLRenderer({
        canvas: canvas
    });
    renderer.setClearColor(0x000000);
    var tmpScene = new THREE.Scene();
  
    // new render-to-texture scene
    this.histogramScene = new THREE.Scene();
    myScene = this.histogramScene;

    // you may need to modify these parameters
    var renderTargetParams = {
    minFilter:THREE.LinearFilter,
    stencilBuffer:false,
    depthBuffer:false
    };

    var myImage = this.config.imageTexture;
    var imageWidth = myImage.image.width;
    var imageHeight = myImage.image.height;

    // create buffer
    var myTexture = new THREE.WebGLRenderTarget( 255, 1, renderTargetParams );
    this.histogramImage = myTexture.image;
    var hShader = window.OROV.VideoEffects.shaders.Histogram.shader;

    // custom RTT materials
    hShader.uniforms.u_texture =  { type: "t", value: myImage };
    myTextureMat = new THREE.ShaderMaterial(
        hShader
    );
    myTextureMat.blending = THREE.AddativeeBlending;



    // Setup render-to-texture scene
    myCamera = new THREE.OrthographicCamera( imageWidth / - 2,
    imageWidth / 2,
    imageHeight / 2,
    imageHeight / - 2, -10000, 10000 );

    var myTextureGeo = new THREE.PlaneGeometry( imageWidth, imageHeight );
    myTextureMesh = new THREE.Mesh( myTextureGeo, myTextureMat );
    myTextureMesh.position.z = -100;
    myScene.add( myTextureMesh );

    var maxColorTexture = new THREE.WebGLRenderTarget( 1, 1, renderTargetParams);
    var maxColorShader = window.OROV.VideoEffects.shaders.HistogramRange.shader;
    maxColorShader.uniforms.u_texture = myTexture;
    var maxColorTextureMat = new THREE.ShaderMaterial(
        maxColorShader
    );
    var maxColorTextureGeo = new THREE.PlaneGeometry( imageWidth, imageHeight );
    maxColorTextureMesh = new THREE.Mesh( myTextureGeo, myTextureMat );
    maxColorTextureMesh.position.z = -101;
    myScene.add( maxColorTextureMesh);


    var histogramTexture = new THREE.WebGLRenderTarget( 255, 100, renderTargetParams);
    var histogramShader = window.OROV.VideoEffects.shaders.HistogramVisualizer.shader;
    histogramShader.uniforms.u_histTexture = myTexture;
    histogramShader.uniforms.u_maxTexture = maxColorTexture;
    
    var histogramTextureMat = new THREE.ShaderMaterial(
        histogramShader
    );
    var histogramTextureGeo = new THREE.PlaneGeometry( imageWidth, imageHeight );
    histogramTextureMesh = new THREE.Mesh( myTextureGeo, myTextureMat );
    histogramTextureMesh.position.z = -101;
    myScene.add( histogramTextureMesh);

    var histogramDisplayCanvas = document.createElement("canvas");
    histogramDisplayCanvas.width=500;
    histogramDisplayCanvas.height=500;

    //TODO: Add an offscrene renderer?
    this.renderHistogram=function(){
        renderer.render( myScene, myCamera, myTexture, true );
        renderer.render( myScene, myCamera, maxColorTexture, true)
        //TODO: Render histogram somewhere?
        return renderer;
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

ShaderLayer.prototype.update = function() {

    var r = this.renderHistogram();

    console.dir(this.histogramImage);
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