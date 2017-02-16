Video Effects Processor (Three.js)
======================

The video effects processor is a pre-configured graphics pipeline that takes a video source as an input, replaces that video source in the DOM, and then renders the augmented video in a canvas where the original video source used to be.

Additional effects are added by creating a Three.js shader and registering it.

A shader is registered by pushing it to the `Windows.OROV.VideoEffects.shaders` array

The Video Effects Processor currently applies the shaders in the order they are registered in the array.

TODO:
- [ ] Design a scheme to configure the shaders used and order they are applied per video source
