
import { vec3, mat4 } from './gl-matrix/index.js';

const cube = {
    vertexSize: 4 * 10, // Byte size of one cube vertex
    positionOffset: 0,
    colorOffset: 4 * 4, // Byte offset of cube vertex color attribute
    UVOffset: 4 * 8,
    vertexCount: 36,
    
    vertexArray: new Float32Array([
      // float4 position, float4 color, float2 uv,
      1, -1, 1, 1,   1, 0, 1, 1,  1, 1,
      -1, -1, 1, 1,  0, 0, 1, 1,  0, 1,
      -1, -1, -1, 1, 0, 0, 0, 1,  0, 0,
      1, -1, -1, 1,  1, 0, 0, 1,  1, 0,
      1, -1, 1, 1,   1, 0, 1, 1,  1, 1,
      -1, -1, -1, 1, 0, 0, 0, 1,  0, 0,
    
      1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
      1, -1, 1, 1,   1, 0, 1, 1,  0, 1,
      1, -1, -1, 1,  1, 0, 0, 1,  0, 0,
      1, 1, -1, 1,   1, 1, 0, 1,  1, 0,
      1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
      1, -1, -1, 1,  1, 0, 0, 1,  0, 0,
    
      -1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
      1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
      1, 1, -1, 1,   1, 1, 0, 1,  0, 0,
      -1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
      -1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
      1, 1, -1, 1,   1, 1, 0, 1,  0, 0,
    
      -1, -1, 1, 1,  0, 0, 1, 1,  1, 1,
      -1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
      -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
      -1, -1, -1, 1, 0, 0, 0, 1,  1, 0,
      -1, -1, 1, 1,  0, 0, 1, 1,  1, 1,
      -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
    
      1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
      -1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
      -1, -1, 1, 1,  0, 0, 1, 1,  0, 0,
      -1, -1, 1, 1,  0, 0, 1, 1,  0, 0,
      1, -1, 1, 1,   1, 0, 1, 1,  1, 0,
      1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
    
      1, -1, -1, 1,  1, 0, 0, 1,  1, 1,
      -1, -1, -1, 1, 0, 0, 0, 1,  0, 1,
      -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
      1, 1, -1, 1,   1, 1, 0, 1,  1, 0,
      1, -1, -1, 1,  1, 0, 0, 1,  1, 1,
      -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
    ])
};

const loadShaderCode = async (url) => {
    const req = await fetch(url);
    if (req.ok) {
        return await req.text();
    }
    else {
        throw new Error(`Error loading shader code from "${url}"`);
    }
}

const init = async (canvas) => {
    // When animating the canvas, the texture size is no longer
    // valid, and the code must be modified.
    const vsCode = await loadShaderCode("simple.vert.wgls");
    const fsCode = await loadShaderCode("simple.frag.wgls");

    const context = canvas.getContext("webgpu");
    if (!context) {
        canvas.parentNode.innerHTML = "<h1>Web GPU is not supported or disabled</h1>";
        throw new Error("Web GPU not supported or disabled");
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    
    const pixelRatio = window.devicePixelRatio;
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const presentationSize = [ width, height ];

    context.configure({
        device,
        format: presentationFormat,        
        width,
        height,
        alphaMode: "opaque"
    });

    const sampleCount = 4;

    const verticesBuffer = device.createBuffer({
        size: cube.vertexArray.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    new Float32Array(verticesBuffer.getMappedRange()).set(cube.vertexArray);
    verticesBuffer.unmap();

    const pipeline = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({ code: vsCode }),
            entryPoint: 'main',
            buffers: [
                {
                    arrayStride: cube.vertexSize,
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: cube.positionOffset,
                            format: 'float32x4'
                        },
                        {
                            shaderLocation: 1,
                            offset: cube.UVOffset,
                            format: 'float32x2'
                        }
                    ]
                }
            ]
        },
        fragment: {
            module: device.createShaderModule({ code: fsCode }),
            entryPoint: 'main',
            targets: [
                {
                    format: presentationFormat
                }
            ]
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'back'
        },
        layout: 'auto',
        multisample: {
            count: 4
        },

        depthScencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        }
    });

    const depthTexture = device.createTexture({
        size: presentationSize,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const uniformBufferSize = 4 * 16;   // 4x4 matrix
    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer
                }
            }
        ]
    });
    

    // We save the render target here, because they will be modified when the canvas is resized
    let renderTarget = null;
    let renderTargetView = null;

    function frame() {
        if (!canvas) {
            return;
        }

        // We need to update the texture size each frame, if the presentation
        // size has changed
        const currentWidth = canvas.clientWidth;
        const currentHeight = canvas.clientHeight;
        if (presentationSize[0] !== currentWidth ||
            presentationSize[1] !== currentHeight)
        {
            if (renderTarget !== null) {
                renderTarget.destroy();
            }

            presentationSize[0] = currentWidth;
            presentationSize[1] = currentHeight;

            /*
             Chrome Canary shows the following message:
             Setting an explicit size when calling configure() on a 
             GPUCanvasContext has been deprecated, and will soon be 
             removed. Please set the canvas width and height attributes
             instead. Note that after the initial call to configure() 
             changes to the canvas width and height will now take effect 
             without the need to call configure() again.

             But it does not work as indicated. If configure(),
             fails because it does not match the canvas size with the texture size.
             texture. If called with size it does not work. Only
             works with width and height
             */
            context.configure({
                device,
                format: presentationFormat,
                //width: currentWidth,
                // height: currentHeight,
                size: presentationSize,
                alphaMode: "premultiplied"
            });

            renderTarget = device.createTexture({
                size: presentationSize,
                sampleCount,
                format: presentationFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            });

            renderTargetView = renderTarget.createView();
        }

        const commandEncoder = device.createCommandEncoder();

        const renderPassDescriptor = {
            colorAttachments: [
                {
                    // view: textureView, this was the texture view from the canvas
                    view: renderTargetView,   // We use the multisample texture
                    // with this we specify which canvas we want to paint the result on
                    resolveTarget: context.getCurrentTexture().createView(),
                    clearValue: {r:0, g:0, b:0, a:1},
                    loadOp: 'clear',
                    storeOp: 'store'
                }
            ],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(3, 1, 0, 0);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}


window.onload = async () => {
    const canvas = document.getElementById("viewportCanvas");
    await init(canvas);


}
