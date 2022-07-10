
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

    const verticesBuffer = device.createBuffer({
        size: cube.vertexArray.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    new Float32Array(verticesBuffer.getMappedRange()).set(cube.vertexArray);
    verticesBuffer.unmap();

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
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

        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        }
    });

    // Textura para el depth buffer
    const depthTexture = device.createTexture({
        size: presentationSize,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    // Buffer para los uniforms
    const uniformBufferSize = 4 * 16;   // 4x4 matrix (4 bytes per element)
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

    const renderPassDescriptor = {
        colorAttachments: [
            {
                view: null,
               
                clearValue: {r:0.5, g:0.5, b:0.5, a:1},
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
    
    const aspect = canvas.clientWidth * canvas.clientHeight;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);

    function getTransformationMatrix() {
        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -4));
        const now = Date.now() / 1000;
        mat4.rotate(
            viewMatrix,
            viewMatrix,
            1,
            vec3.fromValues(Math.sin(now), Math.cos(now), 0)
        );

        const modelViewProjectionMatrix = mat4.create();
        mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

        return new Float32Array(modelViewProjectionMatrix);
    }

    function frame() {
        if (!canvas) {
            return;
        }

        const transformationMatrix = getTransformationMatrix();
        device.queue.writeBuffer(
            uniformBuffer,
            0,
            transformationMatrix.buffer,
            transformationMatrix.bytesOffset,
            transformationMatrix.byteLength
        );
        renderPassDescriptor.colorAttachments[0].view = context
            .getCurrentTexture()
            .createView();

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, uniformBindGroup);
        passEncoder.setVertexBuffer(0, verticesBuffer);
        passEncoder.draw(cube.vertexCount, 1, 0, 0);
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
