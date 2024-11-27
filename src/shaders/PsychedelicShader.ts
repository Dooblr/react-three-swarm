export const PsychedelicShader = {
  vertexShader: `
    varying vec2 vUv;
    varying float vElevation;
    uniform float uTime;

    void main() {
      vUv = uv;
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      
      float elevation = sin(modelPosition.x * 2.0 + uTime) * 
                       cos(modelPosition.z * 2.0 + uTime) * 0.2;
                       
      modelPosition.y += elevation;
      vElevation = elevation;

      gl_Position = projectionMatrix * viewMatrix * modelPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float r = abs(sin(vUv.x * 5.0 + uTime * 0.5));
      float g = abs(cos(vUv.y * 5.0 + uTime * 0.3));
      float b = abs(sin((vUv.x + vUv.y) * 3.0 + uTime * 0.7));
      
      vec3 color = vec3(r, g, b);
      color = mix(color, vec3(0.1, 0.1, 0.3), 0.7); // Mute the colors
      color += vElevation * 0.5; // Add elevation-based lighting
      
      gl_FragColor = vec4(color, 0.8);
    }
  `
} 