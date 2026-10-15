/* GPU logo and optical edge maps; independent of the extension and its release artifacts. */
(function () {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  document.addEventListener('visibilitychange', () => root.classList.toggle('page-hidden', document.hidden));

  const button = document.getElementById('particle-logo');
  const canvas = document.getElementById('logo-particles');
  const vertex = `
    precision highp float;
    attribute vec3 a_target, a_start, a_color;
    attribute float a_size, a_seed;
    uniform vec2 u_resolution;
    uniform vec3 u_pointer;
    uniform vec4 u_ripples[4];
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
      float influence = pow(max(0., 1. - distance / 105.), 2.) * u_pointer.z;
      p.xy += away / max(distance, 1.) * influence * 62.;
      float light = 0.;
      for (int i=0; i<4; i++) {
        float age = u_time - u_ripples[i].z;
        if (u_ripples[i].w > 0. && age >= 0. && age < 2.3) {
          vec2 radial = p.xy - u_ripples[i].xy;
          float radius = length(radial);
          float band = radius - age * 310.;
          float envelope = exp(-pow(band / 30., 2.)) * exp(-age * 1.05) * u_ripples[i].w;
          p.xy += radial / max(radius, 1.) * sin(band * .105) * envelope * 29.;
          p.z += cos(band * .105) * envelope * 48.;
          light += envelope * .26;
        }
      }
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
      uniforms = Object.fromEntries(['resolution','pointer','ripples','time','intro','dpr','dark','motion'].map(name => [name, gl.getUniformLocation(program, 'u_' + (name === 'ripples' ? 'ripples[0]' : name))]));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0,0,0,0);
      button.dataset.renderer = 'webgl'; button.dataset.particles = String(count); resize();
    } catch (error) {
      program = null; button.dataset.renderer = 'fallback';
      console.warn('Particle logo unavailable; using its static mark.', error.message);
    }
  }
  async function loadLogo() {
    const image = new Image(); image.src = 'assets/img/logo.svg?v=glass2'; await image.decode();
    const mask = document.createElement('canvas'); mask.width = 256; mask.height = 224;
    const ctx = mask.getContext('2d', { willReadFrequently:true }); ctx.drawImage(image, 0, 0, 256, 224);
    const pixels = ctx.getImageData(0,0,256,224).data, points = [];
    for (let y=2; y<222; y+=2) for (let x=2; x<254; x+=2) {
      const at = (y*256+x)*4; if (pixels[at+3] < 110) continue;
      const seed = Math.random(), nx = (x + Math.random()*.6 - 128) / 256, ny = (y + Math.random()*.6 - 112) / 224;
      const z = (pixels[at+2] - pixels[at]) / 255 * .06 + Math.sin(nx * 5) * .025;
      const angle = seed * Math.PI * 2, radius = .58 + Math.random() * .7;
      points.push(nx,ny,z,Math.cos(angle)*radius,Math.sin(angle)*radius,(Math.random()-.5)*.6,pixels[at]/255,pixels[at+1]/255,pixels[at+2]/255,1.65+Math.random()*1.35,seed);
    }
    count = points.length / 11; geometry = new Float32Array(points); initialize();
  }
  button.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || motion.matches) return;
    const r = button.getBoundingClientRect(); targetPointer = [event.clientX-r.left-width/2,event.clientY-r.top-height/2,1];
  });
  button.addEventListener('pointerleave', () => { targetPointer[2] = 0; });
  button.addEventListener('click', event => {
    if (motion.matches || !program) return;
    const r = button.getBoundingClientRect(), i = rippleIndex++ % 4 * 4;
    ripples.set([event.detail ? event.clientX-r.left-width/2 : 0,event.detail ? event.clientY-r.top-height/2 : 0,time,1], i); wake();
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stop(); program = null; button.dataset.renderer = 'fallback'; });
  canvas.addEventListener('webglcontextrestored', initialize);
  new ResizeObserver(resize).observe(button);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) wake(); else stop(); }, { threshold:.05 }).observe(button);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else wake(); });
  motion.addEventListener('change', () => { pointer[2] = targetPointer[2] = 0; ripples.fill(0); stop(); wake(); });
  new MutationObserver(() => { dark = root.dataset.theme === 'dark' ? 1 : 0; wake(); }).observe(root, { attributes:true, attributeFilter:['data-theme'] });
  loadLogo().catch(() => { button.dataset.renderer = 'fallback'; });

  // A local chromatic lens belongs to this headline; no global cursor replacement.
  const title = document.querySelector('.hero-title');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const lens = document.createElement('div');
  lens.className = 'title-lens'; lens.setAttribute('aria-hidden', 'true'); document.body.appendChild(lens);
  let lensFrame = 0, lensLast = 0, lensActive = false, lensAlpha = 0;
  let lensX = 0, lensY = 0, aimX = 0, aimY = 0;
  function paintLens(now) {
    lensFrame = 0;
    const dt = Math.min((now - (lensLast || now)) / 1000, .05); lensLast = now;
    const follow = 1 - Math.exp(-dt * 24), fade = 1 - Math.exp(-dt * 18);
    lensX += (aimX - lensX) * follow; lensY += (aimY - lensY) * follow;
    lensAlpha += ((lensActive ? 1 : 0) - lensAlpha) * fade;
    lens.style.opacity = lensAlpha < .003 ? '0' : lensAlpha.toFixed(3);
    lens.style.transform = 'translate3d(' + (lensX-42).toFixed(2) + 'px,' + (lensY-42).toFixed(2) + 'px,0) scale(' + (.65 + lensAlpha*.35).toFixed(3) + ')';
    if (Math.abs((lensActive?1:0)-lensAlpha) > .003 || Math.hypot(aimX-lensX,aimY-lensY) > .1) lensFrame = requestAnimationFrame(paintLens);
  }
  function wakeLens() { if (!lensFrame) { lensLast = performance.now(); lensFrame = requestAnimationFrame(paintLens); } }
  function hideLens(immediate) {
    lensActive = false;
    if (immediate) { cancelAnimationFrame(lensFrame); lensFrame = 0; lensAlpha = 0; lens.style.opacity = '0'; }
    else wakeLens();
  }
  title.parentElement.addEventListener('pointermove', event => {
    if (!finePointer.matches || motion.matches || event.pointerType === 'touch') return;
    const rect = title.getBoundingClientRect();
    const near = event.clientX >= rect.left-12 && event.clientX <= rect.right+12 && event.clientY >= rect.top-12 && event.clientY <= rect.bottom+12;
    if (!near) { if (lensActive) hideLens(false); return; }
    aimX = event.clientX; aimY = event.clientY;
    if (lensAlpha < .003) { lensX = aimX; lensY = aimY; }
    lensActive = true; wakeLens();
  });
  title.parentElement.addEventListener('pointerleave', () => hideLens(false));
  window.addEventListener('scroll', () => hideLens(true), { passive:true });
  window.addEventListener('blur', () => hideLens(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideLens(true); });
  motion.addEventListener('change', () => hideLens(true));
  finePointer.addEventListener('change', () => hideLens(true));

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
