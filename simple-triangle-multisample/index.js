

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

    context.configure({
        device,
        format: presentationFormat,
        width,
        height,
        alphaMode: "premultiplied"
    });

    // Multisample: Number of samples
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

        // Configure multisample in pipeline
        multisample: {
            count: 4
        }
    });

    // Create a custom texture: with multisample, we can't use the texture from canvas
    const texture = device.createTexture({
        size: [ width, height ],
        sampleCount,
        format: presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    // Create a view from the texture
    const view = texture.createView();

    function frame() {
        if (!canvas) {
            return;
        }

        const commandEncoder = device.createCommandEncoder();
        // We no longer use the view from the context of the canvas
        //const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [
                {
                    // view: textureView, this was the texture view from the canvas
                    view,   // We use the multisample texture
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
