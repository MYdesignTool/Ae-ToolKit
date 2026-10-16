/* GPU logo and optical edge maps; independent of the extension and its release artifacts. */
(function () {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  document.addEventListener('visibilitychange', () => root.classList.toggle('page-hidden', document.hidden));

  const button = document.getElementById('particle-logo');
  const canvas = document.getElementById('logo-particles');
  const scene = button.closest('.hero-layout');
  const vertex = `
    precision highp float;
    attribute vec3 a_target, a_start, a_color;
    attribute float a_size, a_seed;
    uniform vec2 u_resolution;
    uniform vec3 u_pointer;
    uniform vec4 u_ripples[4], u_flow[8];
    uniform float u_time, u_intro, u_dpr, u_dark, u_motion;
    varying vec3 v_color;
    varying float v_alpha;
    void main() {
      float scale = min(u_resolution.x * .76, u_resolution.y * .83);
      float reveal = clamp((u_intro - a_seed * .18) / .82, 0., 1.);
      float settle = 1. - pow(1. - reveal, 4.);
      vec3 p = mix(a_start, a_target, settle) * vec3(scale, scale * .875, scale);
      p.xy += vec2(sin(u_time*.65+a_seed*25.), cos(u_time*.48+a_seed*17.)) * 1.25 * u_motion;
      float yaw = sin(u_time * .23) * .10 * u_motion;
      float pitch = cos(u_time * .19) * .045 * u_motion;
      p.xz = mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw)) * p.xz;
      p.yz = mat2(cos(pitch),-sin(pitch),sin(pitch),cos(pitch)) * p.yz;
      vec2 away = p.xy - u_pointer.xy;
      float distance = length(away);
      float influence = pow(max(0., 1. - distance / 40.), 2.) * u_pointer.z;
      p.xy += away * influence * .65;
      p.z += influence * sin(u_time*1.2+a_seed*6.) * 2.;
      float light = 0.;
      for (int i=0; i<4; i++) {
        float age = u_time - u_ripples[i].z;
        if (u_motion > 0. && u_ripples[i].w > 0. && age >= 0. && age < 1.8) {
          vec2 radial = p.xy - u_ripples[i].xy;
          float radius = length(radial), band = radius - age * 215.;
          float envelope = exp(-pow(band / 28., 2.)) * exp(-age * 1.7) * u_ripples[i].w;
          p.xy += radial / max(radius, 1.) * sin(band * .075) * envelope * 12.;
          p.z += cos(band * .075) * envelope * 14.;
          light += envelope * .08;
        }
      }
      // Dragging deforms a continuous path; it never emits expanding click rings.
      vec2 flowOffset = vec2(0.);
      float flowWeight = 0., flowDepth = 0.;
      for (int i=0; i<7; i++) {
        vec4 head = u_flow[i], tail = u_flow[i+1];
        vec2 segment = head.xy - tail.xy;
        float lengthSquared = dot(segment, segment);
        if (u_motion > 0. && head.w > 0. && head.w == tail.w && lengthSquared > .1) {
          float along = clamp(dot(p.xy-tail.xy,segment) / lengthSquared, 0., 1.);
          vec2 closest = tail.xy + segment * along;
          float age = u_time - mix(tail.z,head.z,along);
          if (age >= 0. && age < .4) {
            vec2 direction = segment / sqrt(lengthSquared), normal = vec2(-direction.y,direction.x);
            vec2 offset = p.xy - closest;
            float side = dot(offset,normal), distance = length(offset);
            float width = 20. + age * 30.;
            float envelope = exp(-pow(distance / width, 2.)) * exp(-age * 3.) * (1. - smoothstep(.22,.4,age));
            float wave = abs(side) * .15 - age * 13.;
            flowOffset += (direction * 13. + normal * sign(side) * sin(wave) * 14.) * envelope;
            flowDepth += cos(wave) * envelope * 7.;
            flowWeight += envelope;
          }
        }
      }
      p.xy += flowOffset / max(1.,flowWeight);
      p.z += flowDepth / max(1.,flowWeight);
      light += min(flowWeight,1.) * .09;
      p.xy *= 1. + p.z / (scale * 3.8);
      vec2 clip = p.xy / u_resolution * 2.;
      gl_Position = vec4(clip.x, -clip.y, 0., 1.);
      gl_PointSize = a_size * u_dpr * (1. + p.z / scale * .35 + influence * .22);
      vec3 color = mix(a_color, vec3(.69,.80,1.), u_dark * .52);
      v_color = min(color + light, vec3(1.));
      v_alpha = smoothstep(0., .22, reveal) * (.68 + a_seed * .30);
    }
  `;
  const fragment = `
    precision mediump float;
    varying vec3 v_color;
    varying float v_alpha;
    void main() {
      float radius = length(gl_PointCoord - .5);
      float core = 1. - smoothstep(.18, .5, radius);
      gl_FragColor = vec4(v_color, core * v_alpha);
    }
  `;
  let gl, program, uniforms, buffer, geometry, count = 0;
  let width = 1, height = 1, dpr = 1, frame = 0, visible = true, time = 0, last = 0;
  let pointer = [0, 0, 0], targetPointer = [0, 0, 0];
  let ripples = new Float32Array(16), rippleIndex = 0;
  const flow = new Float32Array(32);
  let stroke = null, strokeDragged = false, strokeId = 0;
  let dark = root.dataset.theme === 'dark' ? 1 : 0;

  function stop() { cancelAnimationFrame(frame); frame = 0; }
  function draw(now) {
    frame = 0;
    if (!program || document.hidden || !visible) return;
    const dt = Math.min((now - (last || now)) / 1000, .05); last = now;
    if (!motion.matches) time += dt;
    const blend = 1 - Math.exp(-dt * 13);
    for (let i=0; i<3; i++) pointer[i] += (targetPointer[i] - pointer[i]) * blend;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform3fv(uniforms.pointer, motion.matches ? [0,0,0] : pointer);
    gl.uniform4fv(uniforms.ripples, ripples);
    gl.uniform4fv(uniforms.flow, flow);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.intro, motion.matches ? 1 : Math.min(time / 1.65, 1));
    gl.uniform1f(uniforms.dpr, dpr);
    gl.uniform1f(uniforms.dark, dark);
    gl.uniform1f(uniforms.motion, motion.matches ? 0 : 1);
    gl.drawArrays(gl.POINTS, 0, count);
    if (!motion.matches) frame = requestAnimationFrame(draw);
  }
  function wake() {
    if (!program || frame || document.hidden || !visible) return;
    last = performance.now(); frame = requestAnimationFrame(draw);
  }
  function resize() {
    const rect = button.getBoundingClientRect();
    width = rect.width; height = rect.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); wake();
  }
  function compile(type, source) {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function initialize() {
    try {
      gl = canvas.getContext('webgl', { alpha:true, antialias:false, premultipliedAlpha:false, powerPreference:'high-performance' });
      if (!gl) { button.dataset.renderer = 'fallback'; return; }
      const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
      program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
      let offset = 0;
      for (const [name, size] of [['target',3],['start',3],['color',3],['size',1],['seed',1]]) {
        const location = gl.getAttribLocation(program, 'a_' + name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 44, offset * 4); offset += size;
      }
      uniforms = Object.fromEntries(['resolution','pointer','ripples','flow','time','intro','dpr','dark','motion'].map(name => [name, gl.getUniformLocation(program, 'u_' + (['ripples','flow'].includes(name) ? name+'[0]' : name))]));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0,0,0,0);
      button.dataset.renderer = 'webgl'; button.dataset.particles = String(count); resize();
    } catch (error) {
      program = null; button.dataset.renderer = 'fallback';
      console.warn('Particle logo unavailable; using its static mark.', error.message);
    }
  }
  async function loadLogo() {
    const image = new Image(); image.src = button.querySelector('.particle-fallback').src; await image.decode();
    const mask = document.createElement('canvas'); mask.width = 256; mask.height = 224;
    const ctx = mask.getContext('2d', { willReadFrequently:true }); ctx.drawImage(image, 0, 0, 256, 224);
    const pixels = ctx.getImageData(0,0,256,224).data, points = [];
    // Sampling in two dimensions: divide spacing by sqrt(2) for twice the particles.
    const spacing = 1.25 / Math.SQRT2;
    for (let y=spacing; y<223; y+=spacing) for (let x=spacing; x<255; x+=spacing) {
      const at = (Math.floor(y)*256+Math.floor(x))*4; if (pixels[at+3] < 110) continue;
      const seed = Math.random(), nx = (x + Math.random()*.6 - 128) / 256, ny = (y + Math.random()*.6 - 112) / 224;
      const z = (pixels[at+2] - pixels[at]) / 255 * .06 + Math.sin(nx * 5) * .025;
      const angle = seed * Math.PI * 2, radius = .58 + Math.random() * .7;
      points.push(nx,ny,z,Math.cos(angle)*radius,Math.sin(angle)*radius,(Math.random()-.5)*.6,pixels[at]/255,pixels[at+1]/255,pixels[at+2]/255,1.0+Math.random()*.85,seed);
    }
    count = points.length / 11; geometry = new Float32Array(points); initialize();
  }
  function addRipple(x, y, strength) {
    const i = rippleIndex++ % 4 * 4;
    ripples.set([x, y, time, strength], i); wake();
  }
  function isControl(event) { return event.target.closest('a,button') && !event.target.closest('#particle-logo'); }
  scene.addEventListener('pointerdown', event => {
    strokeDragged = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 || motion.matches || isControl(event)) return;
    event.preventDefault(); targetPointer[2] = .35;
    const r = button.getBoundingClientRect(), x = event.clientX-r.left-width/2, y = event.clientY-r.top-height/2;
    stroke = { x:event.clientX, y:event.clientY, id:++strokeId };
    // Each stroke has its own identity, so re-entry cannot bridge an unrelated path.
    flow.copyWithin(8,0,24);
    flow.set([x,y,time,stroke.id,x,y,time,stroke.id],0);
  });
  scene.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || motion.matches) return;
    const r = button.getBoundingClientRect(); targetPointer = [event.clientX-r.left-width/2,event.clientY-r.top-height/2,stroke && (event.buttons & 1) ? .35 : 1];
    if (!(event.buttons & 1)) stroke = null;
    if (!stroke || isControl(event)) return;
    if (Math.hypot(event.clientX-stroke.x,event.clientY-stroke.y) > 3) strokeDragged = true;
    // Keep a live endpoint; older anchors preserve turns without frame-by-frame storage.
    if (time-flow[6] > .05 || Math.hypot(targetPointer[0]-flow[4],targetPointer[1]-flow[5]) > 28) flow.copyWithin(4,0,28);
    flow.set([targetPointer[0],targetPointer[1],time,stroke.id],0);
  });
  scene.addEventListener('pointerleave', () => { targetPointer[2] = 0; stroke = null; });
  window.addEventListener('pointerup', () => { stroke = null; if (targetPointer[2]) targetPointer[2] = 1; });
  window.addEventListener('pointercancel', () => { stroke = null; targetPointer[2] = 0; });
  window.addEventListener('blur', () => { stroke = null; targetPointer[2] = 0; });
  scene.addEventListener('click', event => {
    if (isControl(event) || motion.matches || !program) return;
    if (event.detail && strokeDragged) { strokeDragged = false; return; }
    const r = button.getBoundingClientRect();
    addRipple(event.detail ? event.clientX-r.left-width/2 : 0,event.detail ? event.clientY-r.top-height/2 : 0,.625);
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stop(); program = null; button.dataset.renderer = 'fallback'; });
  canvas.addEventListener('webglcontextrestored', initialize);
  new ResizeObserver(resize).observe(button);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) wake(); else stop(); }, { threshold:.05 }).observe(button);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else wake(); });
  motion.addEventListener('change', () => { pointer[2] = targetPointer[2] = 0; stroke = null; flow.fill(0); ripples.fill(0); stop(); wake(); });
  new MutationObserver(() => { dark = root.dataset.theme === 'dark' ? 1 : 0; wake(); }).observe(root, { attributes:true, attributeFilter:['data-theme'] });
  loadLogo().catch(() => { button.dataset.renderer = 'fallback'; });

  // Pointer light stays within the letter strokes, following the site's blue-violet palette.
  const title = document.querySelector('.hero-title'), lines = [...title.querySelectorAll('.title-line')];
  for (const line of lines) { const shine=document.createElement('span'); shine.className='title-shine'; shine.setAttribute('aria-hidden','true'); shine.textContent=line.textContent; line.appendChild(shine); }
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let lightFrame = 0, lightLast = 0, lightActive = false, lightAlpha = 0;
  let lightX = 0, lightY = 0, aimX = 0, aimY = 0;
  function paintLight(now) {
    lightFrame = 0;
    const dt = Math.min((now - (lightLast || now)) / 1000, .05); lightLast = now;
    const follow = 1 - Math.exp(-dt * 24), fade = 1 - Math.exp(-dt * 18);
    lightX += (aimX - lightX) * follow; lightY += (aimY - lightY) * follow;
    lightAlpha += ((lightActive ? 1 : 0) - lightAlpha) * fade;
    title.style.setProperty('--title-light', lightAlpha < .003 ? '0' : (lightAlpha*.85).toFixed(3));
    for (const line of lines) { const r=line.getBoundingClientRect(); line.style.setProperty('--title-x',(lightX-r.left).toFixed(2)+'px'); line.style.setProperty('--title-y',(lightY-r.top).toFixed(2)+'px'); }
    if (Math.abs((lightActive?1:0)-lightAlpha) > .003 || Math.hypot(aimX-lightX,aimY-lightY) > .1) lightFrame = requestAnimationFrame(paintLight);
  }
  function wakeLight() { if (!lightFrame) { lightLast = performance.now(); lightFrame = requestAnimationFrame(paintLight); } }
  function hideLight(immediate) {
    lightActive = false;
    if (immediate) { cancelAnimationFrame(lightFrame); lightFrame = 0; lightAlpha = 0; title.style.setProperty('--title-light','0'); }
    else wakeLight();
  }
  title.parentElement.addEventListener('pointermove', event => {
    if (!finePointer.matches || motion.matches || event.pointerType === 'touch') return;
    const rect = title.getBoundingClientRect();
    const near = event.clientX >= rect.left-12 && event.clientX <= rect.right+12 && event.clientY >= rect.top-12 && event.clientY <= rect.bottom+12;
    if (!near) { if (lightActive) hideLight(false); return; }
    aimX = event.clientX; aimY = event.clientY;
    if (lightAlpha < .003) { lightX = aimX; lightY = aimY; }
    lightActive = true; wakeLight();
  });
  title.parentElement.addEventListener('pointerleave', () => hideLight(false));
  window.addEventListener('scroll', () => hideLight(true), { passive:true });
  window.addEventListener('blur', () => hideLight(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideLight(true); });
  motion.addEventListener('change', () => hideLight(true));
  finePointer.addEventListener('change', () => hideLight(true));

  // Rounded-rectangle surface normals displace only the bevel, keeping the glass center calm.
  if (!CSS.supports('backdrop-filter', 'url("#glass-optics")')) return;
  const ns = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { const el = document.createElementNS(ns, tag); for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value); return el; }
  const filters = svg('svg', { width:0, height:0, 'aria-hidden':'true', focusable:'false' });
  filters.style.position = 'absolute'; document.body.appendChild(filters);
  const records = new Map();
  function distance(x,y,w,h,r) { const qx=Math.abs(x-w/2)-(w/2-r), qy=Math.abs(y-h/2)-(h/2-r); return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r; }
  function update(el) {
    const record = records.get(el); if (!record || !record.visible) return;
    const w=el.clientWidth+2, h=el.clientHeight+2; if (w===record.width && h===record.height) return;
    record.width=w; record.height=h;
    const raw=getComputedStyle(el).borderTopLeftRadius, radius=Math.min(w/2,h/2,parseFloat(raw)*(raw.includes('%')?Math.min(w,h)/100:1));
    const map=document.createElement('canvas'), ratio=Math.min(1,512/Math.max(w,h)); map.width=Math.max(1,Math.round(w*ratio)); map.height=Math.max(1,Math.round(h*ratio));
    const ctx=map.getContext('2d'), image=ctx.createImageData(map.width,map.height), data=image.data;
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
      const px=(x+.5)/ratio,py=(y+.5)/ratio,d=-distance(px,py,w,h,radius),i=(y*map.width+x)*4;
      let nx=0,ny=0;
      if(d>=0&&d<18){const dx=distance(px+.5,py,w,h,radius)-distance(px-.5,py,w,h,radius),dy=distance(px,py+.5,w,h,radius)-distance(px,py-.5,w,h,radius),n=Math.hypot(dx,dy)||1,curve=Math.pow(1-d/18,1.8)*.42;nx=dx/n*curve;ny=dy/n*curve;}
      data[i]=(0.5+nx)*255;data[i+1]=(0.5+ny)*255;data[i+2]=128;data[i+3]=255;
    }
    ctx.putImageData(image,0,0); record.map.setAttribute('href',map.toDataURL()); el.dataset.refracted='true';
  }
  const observer = new ResizeObserver(entries => entries.forEach(entry => update(entry.target)));
  const intersection = new IntersectionObserver(entries => entries.forEach(entry => { const r=records.get(entry.target);r.visible=entry.isIntersecting; if(r.visible)update(entry.target); }), { rootMargin:'100px' });
  document.querySelectorAll('.glass, .site-header').forEach((el,index) => {
    const id='glass-optics-'+index, filter=svg('filter',{id,x:0,y:0,width:'100%',height:'100%','color-interpolation-filters':'sRGB'});
    const map=svg('feImage',{x:0,y:0,width:'100%',height:'100%',preserveAspectRatio:'none',result:'bevel'});
    filter.append(map,svg('feDisplacementMap',{in:'SourceGraphic',in2:'bevel',scale:32,xChannelSelector:'R',yChannelSelector:'G'}));filters.appendChild(filter);
    el.style.setProperty('--refraction','url("#'+id+'")'); records.set(el,{map,width:0,height:0,visible:false});observer.observe(el);intersection.observe(el);
  });
})();
