

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
        alphaMode: "premultiplied"
    });

    const sampleCount = 4;

    const pipeline = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({ code: vsCode }),
            entryPoint: 'main'
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
            topology: 'triangle-list'
        },
        layout: 'auto',
        multisample: {
            count: 4
        }
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

            context.configure({
                device,
                format: presentationFormat,
                // size is deprecated, the browser shows a warning message
                // indicating that you must to use width and height, but
                // doing so, the configure function fails updating the canvas
                // texture size in the next .configure() call, inside frame() function
                //width: currentWidth,
                //height: currentHeight,
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
            ]
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
