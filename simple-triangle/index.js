

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
    const presentationSize = [
        canvas.clientWidth * pixelRatio,
        canvas.clientHeight * pixelRatio
    ];
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: presentationFormat,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        alphaMode: "premultiplied"
    });

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
        layout: 'auto'
    });

    function frame() {
        if (!canvas) {
            return;
        }

        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
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
