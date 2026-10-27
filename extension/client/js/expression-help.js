/* Offline, original help summaries. AE semantics checked against Adobe's expression reference.
 * https://helpx.adobe.com/cn/after-effects/desktop/work-with-expressions/expression-language-reference/expression-language-reference.html
 * Text styles: https://helpx.adobe.com/after-effects/using/expressions-text-properties.html
 * JavaScript: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
 * Keep descriptions separate from insertion text; opening help never runs an expression.
 */
AELT.expressionHelp = (function () {
  var docs = {}, args = {};
  function parameter(names, type, zh, en) {
    names.split(' ').forEach(function (name) { args[name] = {type:type, text:[zh, en]}; });
  }
  function define(keys, zh, en, extra) {
    keys.split(' ').forEach(function (key) { docs[key] = {text:[zh, en], extra:extra || {}}; });
  }
  parameter('freq', 'Number', '每秒摆动次数。', 'Wiggles per second.');
  parameter('amp', 'Number', '摆动幅度，单位与当前属性一致。', 'Wiggle amplitude in the property’s units.');
  parameter('octaves', 'Number', '叠加的噪声层数；增加可获得更多细节。', 'Number of noise octaves; higher values add detail.');
  parameter('amp_mult', 'Number', '每增加一层噪声时的振幅倍率。', 'Amplitude multiplier for each additional octave.');
  parameter('t atTime', 'Number', '采样或计算时间，单位为秒。', 'Sample or evaluation time in seconds.');
  parameter('width', 'Number', '平滑采样的时间范围，单位为秒。', 'Smoothing time window in seconds.');
  parameter('samples', 'Number', '采样数量，通常使用奇数。', 'Sample count; an odd number is usually useful.');
  parameter('type', 'String', '循环方式：cycle 重复、pingpong 往返、offset 累加偏移、continue 延续速度。', 'Loop mode: cycle repeats, pingpong reverses, offset accumulates, continue extends velocity.');
  parameter('numKeyframes', 'Number', '循环的关键帧间隔数；0 表示全部。continue 模式不使用此参数。', 'Number of keyframe intervals; 0 uses all. Not used by continue.');
  parameter('duration', 'Number', '循环区间的秒数；0 使用图层边界。continue 模式不使用此参数。', 'Loop duration in seconds; 0 uses the layer boundary. Not used by continue.');
  parameter('index', 'Number', '关键帧序号，从 1 开始。', 'Keyframe index, starting at 1.');
  parameter('countUp', 'Number', '向上访问的属性组层数。', 'Number of property-group levels to move up.');
  parameter('name', 'String', '要查找的项目名称。', 'Name of the item to find.');
  parameter('nameOrIndex', 'String / Number', '名称或从 1 开始的序号。', 'Name or index starting at 1.');
  parameter('comment', 'String', '用于查找图层的注释文本。', 'Layer comment to search for.');
  parameter('point', 'Array', '需要转换或采样的点坐标。', 'Point coordinates to transform or sample.');
  parameter('vec', 'Array', '参与运算的向量分量数组。', 'Vector component array.');
  parameter('vec1', 'Array', '第一个向量或点坐标。', 'First vector or point.');
  parameter('vec2', 'Array', '第二个向量或点坐标。', 'Second vector or point.');
  parameter('amount', 'Number', '对各向量分量使用的乘数或除数。', 'Multiplier or divisor applied to each component.');
  parameter('fromPoint', 'Array[3]', '观察起点的世界坐标。', 'World-space origin.');
  parameter('atPoint', 'Array[3]', '朝向目标的世界坐标。', 'World-space target.');
  parameter('includeExtents', 'Boolean', '是否计入形状外延或段落文本框范围。', 'Include shape extents or paragraph text bounds.');
  parameter('radius', 'Array[2]', '采样矩形的水平、垂直半径（像素）。', 'Horizontal and vertical sampling half-size in pixels.');
  parameter('postEffect', 'Boolean', 'true 采样应用本图层蒙版和效果后的颜色。', 'true samples after this layer’s masks and effects.');
  parameter('dataPath', 'Array', 'mgJSON 数据层级的索引路径。', 'Index path into the mgJSON hierarchy.');
  parameter('t0', 'Number', '采样范围起始时间，单位为秒。', 'Start of the sample interval in seconds.');
  parameter('t1', 'Number', '采样范围结束时间，单位为秒。', 'End of the sample interval in seconds.');
  parameter('charIndex', 'Number', '字符序号，从 0 开始。', 'Character index, starting at 0.');
  parameter('text', 'String', '要设置的文本内容。', 'Text content to set.');
  parameter('font', 'String', '字体的 PostScript 名称。', 'PostScript font name.');
  parameter('size', 'Number', '字号。', 'Font size.');
  parameter('color', 'Array[3]', 'RGB 颜色，每个分量通常为 0–1。', 'RGB color, usually with components from 0 to 1.');
  parameter('value', 'Number / Array', '参与计算或设置的值。', 'Value to compute with or assign.');
  parameter('points', 'Array', '路径顶点的 [x,y] 数组。', 'Array of [x,y] path vertices.');
  parameter('inTangents', 'Array', '各顶点入切线的相对位移；[] 表示零切线。', 'Incoming tangent offsets; [] uses zero tangents.');
  parameter('outTangents', 'Array', '各顶点出切线的相对位移；[] 表示零切线。', 'Outgoing tangent offsets; [] uses zero tangents.');
  parameter('isClosed', 'Boolean', '是否连接最后一个顶点与第一个顶点。', 'Connect the final vertex to the first.');
  parameter('percentage', 'Number', '沿路径弧长的位置，0 为起点、1 为终点。', 'Fraction of path arc length, from 0 at the start to 1 at the end.');
  parameter('framesPerSecond fps timecodeBase', 'Number', '每秒帧数。', 'Frames per second.');
  parameter('frames', 'Number', '需要换算的帧数，可使用小数。', 'Frame count to convert; fractions are allowed.');
  parameter('isDuration', 'Boolean', 'true 按时长处理；false 按绝对时间处理，舍入方式不同。', 'true treats the input as a duration; false as absolute time, with different rounding.');
  parameter('ntscDropFrame', 'Boolean', '是否采用 NTSC 丢帧时间码。', 'Use NTSC drop-frame timecode.');
  parameter('degrees', 'Number', '以度表示的角度。', 'Angle in degrees.');
  parameter('radians', 'Number', '以弧度表示的角度。', 'Angle in radians.');
  parameter('limit1', 'Number / Array', '限值的一端。', 'One clamp boundary.');
  parameter('limit2', 'Number / Array', '限值的另一端。', 'Other clamp boundary.');
  parameter('tMin', 'Number', '输入区间起点，对应 value1。', 'Input range start, corresponding to value1.');
  parameter('tMax', 'Number', '输入区间终点，对应 value2。', 'Input range end, corresponding to value2.');
  parameter('value1', 'Number / Array', '插值输出的起始值。', 'Starting output value.');
  parameter('value2', 'Number / Array', '插值输出的结束值。', 'Ending output value.');
  parameter('minValOrArray', 'Number / Array', '双参数形式的下界；单参数形式改用上界。', 'Lower bound in the two-argument form; the one-argument form takes an upper bound.');
  parameter('maxValOrArray', 'Number / Array', '上界；数组可分别指定各维度的范围。', 'Upper bound; an array supplies a bound per component.');
  parameter('offset', 'Number', '随机种子的偏移值。', 'Random seed offset.');
  parameter('timeless', 'Boolean', 'true 时随机种子不随时间改变。', 'true makes the random seed independent of time.');
  parameter('valOrArray', 'Number / Array', '噪声采样坐标。', 'Noise sampling coordinates.');
  parameter('rgbaArray', 'Array[4]', '红、绿、蓝、Alpha 分量数组。', 'Red, green, blue and alpha components.');
  parameter('hslaArray', 'Array[4]', '色相、饱和度、亮度、Alpha 分量数组。', 'Hue, saturation, lightness and alpha components.');
  parameter('hexString', 'String', '十六进制颜色，如 FF0000。', 'Hexadecimal color, such as FF0000.');
  parameter('string', 'String', '需要转换的字符串。', 'String to convert.');
  parameter('radix', 'Number', '整数进制（2–36）；省略时按前缀识别十进制或十六进制。', 'Integer base (2–36); omission infers decimal or hexadecimal from the prefix.');
  parameter('x y a b base exponent', 'Number', '参与数学运算的数值。', 'Numeric operand.');
  parameter('base', 'Number', '乘方运算的底数。', 'Base of the power.');
  parameter('exponent', 'Number', '乘方运算的指数。', 'Exponent of the power.');
  parameter('replacer', 'Function / Array / null', '控制哪些属性参与 JSON 序列化。', 'Controls which properties are serialized.');
  parameter('space', 'Number / String', 'JSON 输出的缩进宽度或缩进字符串。', 'Indentation width or string for JSON output.');
  parameter('reviver', 'Function', '解析后转换各属性值的回调。', 'Callback that transforms parsed property values.');

  var wiggleForms = {allowedCounts:[2,3,4,5], trailingOptional:true,
    note:['仅可从末尾依次省略参数；指定 t 时需补齐前面的参数。','Omit trailing arguments in order; to set t, supply all preceding arguments.'],
    forms:[['(freq, amp)',2],['(freq, amp, octaves, amp_mult, t)',5]]};
  define('Property.wiggle', '给属性值叠加随机摆动。', 'Add random variation to the property value.', wiggleForms);
  define('Property.temporalWiggle', '扰动采样时间以读取已有动画；属性需要有随时间变化的值。', 'Vary the sampling time of an animated property.', {
    allowedCounts:[2,3,4,5], trailingOptional:true, note:wiggleForms.note, forms:wiggleForms.forms,
    parameters:{amp:{type:'Number', text:['时间扰动的幅度（秒）。','Time variation amplitude in seconds.']}}});
  define('Property.valueAtTime', '读取指定时刻的属性值。', 'Read the property value at a specific time.');
  define('Property.velocityAtTime', '读取指定时刻的变化速度向量。', 'Read the velocity at a specific time.');
  define('Property.speedAtTime', '读取指定时刻的空间速率。', 'Read the spatial speed at a specific time.');
  define('Property.smooth', '对时间窗口内的样本取平均，使变化更平滑。', 'Average samples across a time window to smooth changes.');
  define('Property.loopIn', '在首个关键帧之前循环动画。', 'Loop animation before the first keyframe.');
  define('Property.loopOut', '在最后一个关键帧之后循环动画。', 'Loop animation after the final keyframe.');
  define('Property.loopInDuration', '按秒数指定向前循环的动画区间。', 'Loop before the first keyframe using a duration in seconds.');
  define('Property.loopOutDuration', '按秒数指定向后循环的动画区间。', 'Loop after the final keyframe using a duration in seconds.');
  define('Property.key', '按序号读取关键帧。', 'Find a keyframe by index.');
  define('Property.nearestKey', '查找离指定时刻最近的关键帧。', 'Find the keyframe nearest a time.');
  define('Property.propertyGroup Group.propertyGroup', '访问当前属性的上级属性组。', 'Access an ancestor property group.');
  define('Marker.key', '按序号或标记名称读取标记。', 'Find a marker by index or name.');
  define('Marker.nearestKey', '查找离指定时刻最近的标记。', 'Find the marker nearest a time.');
  define('Comp.layer', '按名称或序号查找合成中的图层。也可按另一图层及相对序号查找。', 'Find a layer by name or index, or relative to another layer.', {forms:[['(nameOrIndex)',1],['(otherLayer, relIndex)',2]]});
  parameter('otherLayer', 'Layer', '作为相对查找起点的图层。', 'Reference layer for relative lookup.');
  parameter('relIndex', 'Number', '相对于参考图层的序号偏移。', 'Index offset from the reference layer.');
  define('Comp.layerByComment', '通过图层注释查找图层。', 'Find a layer by its comment.');
  define('Layer.effect', '查找当前图层的效果控件。', 'Find an effect on this layer.');
  define('Layer.content', '查找形状图层的内容组或内容属性。', 'Find a shape-layer content group or property.');
  define('Layer.mask', '查找当前图层的蒙版。', 'Find a mask on this layer.');
  define('Layer.toComp', '把图层空间中的点转换到合成空间。', 'Transform a point from layer space to composition space.');
  define('Layer.fromComp', '把合成空间中的点转换到图层空间。', 'Transform a point from composition space to layer space.');
  define('Layer.toWorld', '把图层空间中的点转换到世界空间。', 'Transform a point from layer space to world space.');
  define('Layer.fromWorld', '把世界空间中的点转换到图层空间。', 'Transform a point from world space to layer space.');
  define('Layer.toCompVec', '把方向向量从图层空间转换到合成空间。', 'Transform a direction vector from layer space to composition space.');
  define('Layer.fromCompVec', '把方向向量从合成空间转换到图层空间。', 'Transform a direction vector from composition space to layer space.');
  define('Layer.toWorldVec', '把方向向量从图层空间转换到世界空间。', 'Transform a direction vector from layer space to world space.');
  define('Layer.fromWorldVec', '把方向向量从世界空间转换到图层空间。', 'Transform a direction vector from world space to layer space.');
  define('Layer.fromCompToSurface', '将合成空间中的点投影到图层的表面。', 'Project a composition-space point onto the layer surface.');
  define('Layer.sourceRectAtTime', '读取图层内容的 top、left、width、height 边界。', 'Read the top, left, width and height of layer content.');
  define('Layer.sampleImage', '采样图层指定区域的平均 RGBA 颜色。', 'Sample the average RGBA color of a layer region.', {parameters:{point:{type:'Array[2]',text:['图层空间中的采样中心 [x,y]。','Sampling center [x,y] in layer space.']}}});
  define('Layer.sourceTime', '将合成时间换算为图层源时间。', 'Convert composition time to source time.');
  define('Footage.dataValue', '读取 mgJSON 路径指定的数据值。', 'Read the data value at an mgJSON path.');
  define('Footage.dataKeyCount', '读取动态数据流的样本数量。', 'Read the sample count of a dynamic data stream.');
  define('Footage.dataKeyTimes', '读取指定时间段内的数据样本时间。', 'Read data sample times within an interval.');
  define('Footage.dataKeyValues', '读取指定时间段内的数据样本值。', 'Read data sample values within an interval.');
  define('SourceText.getStyleAt', '读取指定字符在指定时刻的文本样式。', 'Read a character’s text style at a specific time.');
  define('TextStyle.setText', '设置文本内容，返回可继续链式设置的样式。', 'Set text content and return the style for chaining.');
  define('TextStyle.setFont', '设置字体。', 'Set the font.');
  define('TextStyle.setFontSize', '设置字号。', 'Set the font size.');
  define('TextStyle.setFillColor', '设置文字填充颜色。', 'Set the text fill color.');
  define('TextStyle.setStrokeColor', '设置文字描边颜色。', 'Set the text stroke color.');
  define('TextStyle.setStrokeWidth', '设置文字描边宽度。', 'Set the text stroke width.', {parameters:{width:{type:'Number',text:['文字描边的宽度。','Text stroke width.']}}});
  define('TextStyle.setTracking', '设置字符间距。', 'Set character tracking.', {parameters:{value:{type:'Number',text:['字符间距值。','Tracking value.']}}});
  define('TextStyle.setLeading', '设置行距。', 'Set line spacing.', {parameters:{value:{type:'Number',text:['行与行之间的距离。','Distance between lines.']}}});
  define('TextStyle.setApplyFill TextStyle.setApplyStroke TextStyle.setAutoLeading', '启用或关闭对应的文字样式选项。', 'Enable or disable this text style option.', {parameters:{value:{type:'Boolean',text:['true 启用，false 关闭。','true enables; false disables.']}}});
  define('Path.points', '读取路径顶点的坐标数组。', 'Read the array of path vertices.');
  define('Path.inTangents', '读取路径顶点的入切线位移。', 'Read incoming tangent offsets.');
  define('Path.outTangents', '读取路径顶点的出切线位移。', 'Read outgoing tangent offsets.');
  define('Path.isClosed', '检查路径是否闭合。', 'Check whether the path is closed.');
  define('Path.pointOnPath', '按弧长比例获取路径上的点。', 'Get a point at a fraction of the path’s arc length.');
  define('Path.tangentOnPath', '按弧长比例获取路径的单位切向量。', 'Get a unit tangent at a fraction of the path’s arc length.');
  define('Path.normalOnPath', '按弧长比例获取路径的单位法向量。', 'Get a unit normal at a fraction of the path’s arc length.');
  define('Path.createPath', '由顶点和切线创建路径；不传参数时生成默认矩形。', 'Create a path from vertices and tangents; no arguments creates the default rectangle.');
  define('Global.comp', '按工程中的名称查找合成。', 'Find a composition by its project name.');
  define('Global.footage', '按工程中的名称查找素材。', 'Find footage by its project name.');
  define('Global.posterizeTime', '设置后续表达式计算的每秒更新次数。', 'Set the update rate for the rest of the expression.');
  define('Global.timeToFrames', '将秒换算为帧数。', 'Convert seconds to frame count.');
  define('Global.framesToTime', '将帧数换算为秒。', 'Convert frame count to seconds.');
  define('Global.timeToTimecode', '将时间格式化为时间码。', 'Format a time as timecode.');
  define('Global.timeToCurrentFormat', '按当前工程的时间显示格式生成字符串。', 'Format time using the project’s current display format.');
  define('Global.degreesToRadians', '将角度换算为弧度。', 'Convert degrees to radians.');
  define('Global.radiansToDegrees', '将弧度换算为角度。', 'Convert radians to degrees.');
  define('Global.clamp', '把数值或各数组分量限制在两端限值内。', 'Clamp a number or array components between two bounds.');
  var interpolation = {conditional:['tMin','tMax'], forms:[['(t, value1, value2)',3],['(t, tMin, tMax, value1, value2)',5]], parameters:{t:{type:'Number',text:['输入位置或时间；三参数形式使用 0–1 区间。','Input position or time; the three-argument form uses a 0–1 range.']}}};
  define('Global.linear', '在两个值之间线性插值，超出输入区间时保持端点值。', 'Interpolate linearly between two values, clamping outside the input range.', interpolation);
  define('Global.ease', '在两个值之间插值，起点和终点均缓动。', 'Interpolate with easing at both ends.', interpolation);
  define('Global.easeIn', '在两个值之间插值，仅起点缓动。', 'Interpolate with easing at the start.', interpolation);
  define('Global.easeOut', '在两个值之间插值，仅终点缓动。', 'Interpolate with easing at the end.', interpolation);
  var randomForms = {optional:['minValOrArray','maxValOrArray'], forms:[['()',0],['(maxValOrArray)',1],['(minValOrArray, maxValOrArray)',2]]};
  define('Global.random', '生成均匀分布的随机数或数组；不传参数时范围为 0–1。', 'Generate uniformly distributed random values; no arguments uses 0–1.', randomForms);
  define('Global.gaussRandom', '生成高斯分布随机值；约 90% 在指定范围内，可能超出上下界。', 'Generate Gaussian random values; about 90% lie in the given range.', randomForms);
  define('Global.seedRandom', '更改后续随机计算的种子。', 'Change the seed for subsequent random calculations.');
  define('Global.noise', '在指定坐标采样连续噪声。', 'Sample continuous noise at given coordinates.');
  define('Global.add', '将两个向量逐分量相加。', 'Add two vectors component by component.');
  define('Global.sub', '将两个向量逐分量相减。', 'Subtract two vectors component by component.');
  define('Global.mul', '将向量的各分量乘以指定数值。', 'Multiply every vector component by a number.');
  define('Global.div', '将向量的各分量除以指定数值。', 'Divide every vector component by a number.');
  define('Global.dot', '计算两个向量的点积。', 'Compute the dot product of two vectors.');
  define('Global.cross', '计算两个向量的叉积。', 'Compute the cross product of two vectors.');
  define('Global.normalize', '将向量转换为长度为 1 的单位向量。', 'Convert a vector to unit length.');
  define('Global.length', '单参数返回向量长度；双参数返回两点距离。', 'One argument gives vector length; two give the distance between points.', {conditional:['vec2'], forms:[['(vec)',1],['(vec1, vec2)',2]]});
  define('Global.lookAt', '计算使图层 Z 轴指向目标点的方向角。', 'Compute orientation angles that aim the layer’s Z axis at a target.');
  define('Global.rgbToHsl', '将 RGBA 颜色转换为 HSLA。', 'Convert RGBA color to HSLA.');
  define('Global.hslToRgb', '将 HSLA 颜色转换为 RGBA。', 'Convert HSLA color to RGBA.');
  define('Global.hexToRgb', '将十六进制颜色字符串转换为 RGBA。', 'Convert a hexadecimal color string to RGBA.');
  define('Global.parseInt', '把字符串解析为整数。', 'Parse a string as an integer.', {optional:['radix']});
  define('Global.parseFloat', '把字符串解析为浮点数。', 'Parse a string as a floating-point number.');
  var coercionValue = {parameters:{value:{type:'Any',text:['待转换并检查的值。','Value to convert and check.']}}};
  define('Global.isNaN', '判断转换为数值后的结果是否为 NaN。', 'Check whether numeric conversion produces NaN.', coercionValue);
  define('Global.isFinite', '判断转换后的数值是否有限。', 'Check whether numeric conversion produces a finite number.', coercionValue);
  define('JSON.parse', '解析 JSON 字符串。', 'Parse a JSON string.', {optional:['reviver'],parameters:{text:{type:'String',text:['合法的 JSON 字符串。','A valid JSON string.']}}});
  define('JSON.stringify', '把值序列化为 JSON 字符串。', 'Serialize a value as a JSON string.', {optional:['replacer','space'],parameters:{value:{type:'Any',text:['需要序列化的 JavaScript 值。','JavaScript value to serialize.']}}});
  var math = {
    abs:['绝对值','Absolute value'], acos:['反余弦（弧度）','Arccosine in radians'], asin:['反正弦（弧度）','Arcsine in radians'],
    atan:['反正切（弧度）','Arctangent in radians'], atan2:['根据 y、x 计算方位角（弧度）','Angle from y and x in radians'],
    ceil:['向上取整','Round upward'], cos:['余弦，输入为弧度','Cosine, with input in radians'], exp:['自然指数 e 的 x 次幂','Natural exponential'],
    floor:['向下取整','Round downward'], log:['自然对数','Natural logarithm'], max:['多个数值中的最大值','Maximum of the supplied numbers'],
    min:['多个数值中的最小值','Minimum of the supplied numbers'], pow:['底数的指数次幂','Base raised to an exponent'], random:['0（含）到 1（不含）的随机数','Random number from 0 inclusive to 1 exclusive'],
    round:['四舍五入到整数','Round to the nearest integer'], sin:['正弦，输入为弧度','Sine, with input in radians'], sqrt:['平方根','Square root'],
    tan:['正切，输入为弧度','Tangent, with input in radians'], sign:['返回数值的正负号','Sign of a number'], trunc:['去掉小数部分','Remove the fractional part']
  };
  Object.keys(math).forEach(function (name) { define('Math.' + name, math[name][0] + '。', math[name][1] + '.', /^(max|min)$/.test(name) ? {variadic:true} : {}); });

  function property(keys, type, zh, en) { define(keys, zh, en, {valueType:type}); }
  property('Global.time', 'Number', '当前合成时间，单位为秒。', 'Current composition time in seconds.');
  property('Global.colorDepth', 'Number', '工程每通道色深：8、16 或 32 位。', 'Project bits per channel: 8, 16 or 32.');
  property('Global.textIndex', 'Number', '文本表达式选择器中当前字符、单词或行的序号，从 1 开始。', 'Current character, word or line index in a text expression selector, starting at 1.');
  property('Global.textTotal', 'Number', '文本表达式选择器中参与计算的字符、单词或行总数。', 'Total characters, words or lines evaluated by a text expression selector.');
  property('Global.selectorValue', 'Number / Array', '文本表达式选择器在当前文本单元上的影响量。', 'Text expression selector influence on the current text unit.');
  property('Global.thisComp', 'Comp', '包含当前表达式的合成。', 'Composition containing this expression.');
  property('Global.thisLayer', 'Layer', '包含当前表达式的图层。', 'Layer containing this expression.');
  property('Global.thisProperty', 'Property', '正在计算当前表达式的属性。', 'Property evaluating this expression.');
  property('Global.Math', 'Object', 'JavaScript 数学常量和函数，如 Math.PI、Math.sin()。', 'JavaScript math constants and functions, such as Math.PI and Math.sin().');
  property('Global.JSON', 'Object', 'JSON 字符串的解析与序列化工具。', 'Utilities for parsing and serializing JSON strings.');
  property('Layer.active', 'Boolean', '当前时间图层是否活动；普通图层需视频开关开启且处于入出点之间。', 'Whether the layer is active now; ordinary layers need video enabled and the time within their in/out points.');
  property('Layer.audioActive', 'Boolean', '音频开关开启，且当前时间位于图层入点与出点之间时为 true。', 'true when audio is enabled and the current time is within the layer’s in/out points.');
  property('Layer.enabled', 'Boolean', '图层的视频开关是否开启。', 'Whether the layer’s video switch is enabled.');
  property('Layer.hasParent', 'Boolean', '图层是否具有父级。', 'Whether the layer has a parent.');
  property('Layer.hasVideo', 'Boolean', '图层的源是否包含视频内容。', 'Whether the layer source has video.');
  property('Layer.hasAudio', 'Boolean', '图层的源是否包含音频内容。', 'Whether the layer source has audio.');
  property('Layer.index', 'Number', '图层在合成中的序号，从顶部的 1 开始。', 'Layer index in the composition, starting at 1 at the top.');
  property('Layer.inPoint', 'Number', '图层入点在合成时间轴上的时间（秒）。', 'Layer in-point on the composition timeline, in seconds.');
  property('Layer.outPoint', 'Number', '图层出点在合成时间轴上的时间（秒）。', 'Layer out-point on the composition timeline, in seconds.');
  property('Layer.startTime', 'Number', '图层起始时间，单位为秒。', 'Layer start time in seconds.');
  property('Layer.stretch', 'Number', '图层的时间伸缩百分比，100 表示原速。', 'Layer time-stretch percentage; 100 is normal speed.');
  property('Layer.parent', 'Layer', '当前图层的父图层；使用前可先检查 hasParent。', 'Parent layer; check hasParent before accessing it.');
  property('Layer.source', 'Comp / Footage', '图层引用的源合成或素材。', 'Source composition or footage used by the layer.');
  property('Layer.transform', 'Transform', '图层的位置、缩放、旋转等变换属性组。', 'Layer transform group containing position, scale, rotation and related properties.');
  property('Layer.text', 'Text', '文本图层的文本属性组。', 'Text property group of a text layer.');
  property('Layer.marker Comp.marker', 'Marker', '访问图层或合成的标记，可继续使用 key()、nearestKey()。', 'Access layer or composition markers with key() and nearestKey().');
  property('Layer.name Comp.name Footage.name Property.name Group.name', 'String', '当前对象的名称。', 'Name of this object.');
  property('Layer.width Comp.width Footage.width', 'Number', '当前图层、合成或素材的宽度（像素）。', 'Width of the layer, composition or footage in pixels.');
  property('Layer.height Comp.height Footage.height', 'Number', '当前图层、合成或素材的高度（像素）。', 'Height of the layer, composition or footage in pixels.');
  property('Comp.pixelAspect Footage.pixelAspect', 'Number', '像素宽高比；方形像素为 1。', 'Pixel aspect ratio; square pixels use 1.');
  property('Comp.duration Footage.duration', 'Number', '合成或素材的总时长（秒）。', 'Duration of the composition or footage in seconds.');
  property('Comp.frameDuration Footage.frameDuration', 'Number', '一帧的时长（秒）；倒数为帧率。', 'Duration of one frame in seconds; its reciprocal is the frame rate.');
  property('Comp.displayStartTime', 'Number', '合成时间显示的起始时间（秒）。', 'Composition display start time in seconds.');
  property('Comp.numLayers', 'Number', '合成中的图层数量。', 'Number of layers in the composition.');
  property('Comp.ntscDropFrame Footage.ntscDropFrame', 'Boolean', '时间码是否使用 NTSC 丢帧格式。', 'Whether timecode uses NTSC drop-frame format.');
  property('Comp.shutterAngle', 'Number', '运动模糊的快门角度（度）。', 'Motion-blur shutter angle in degrees.');
  property('Comp.shutterPhase', 'Number', '运动模糊的快门相位（度）。', 'Motion-blur shutter phase in degrees.');
  property('Comp.bgColor', 'Array[4]', '合成背景颜色的 RGBA 分量。', 'RGBA components of the composition background color.');
  property('Comp.activeCamera', 'Camera', '当前时间用于渲染合成的活动摄像机。', 'Active camera used to render the composition at the current time.');
  property('Footage.sourceData', 'Object / Array', '读取 JSON 素材中解析后的数据。', 'Parsed data from JSON footage.');
  property('Footage.sourceText', 'String', '读取素材文件的原始文本内容。', 'Raw text content of the footage file.');
  property('Property.value', 'Number / Array / String', '当前时间的属性值。', 'Property value at the current time.');
  property('Property.velocity', 'Number / Array', '当前时间属性的变化速度；空间属性返回速度向量。', 'Current property velocity; spatial properties return a velocity vector.');
  property('Property.speed', 'Number', '当前时间空间属性的非负速率。', 'Current nonnegative speed of a spatial property.');
  property('Property.numKeys Marker.numKeys', 'Number', '当前属性的关键帧数量，或标记组中的标记数量。', 'Number of keyframes on the property or markers in the marker group.');
  property('Property.propertyIndex Group.propertyIndex', 'Number', '当前属性在所属属性组中的序号，从 1 开始。', 'Index within the containing property group, starting at 1.');
  property('Group.numProperties', 'Number', '属性组中直接包含的属性数量。', 'Number of properties directly contained in this group.');
  property('Key.time', 'Number', '当前关键帧或标记的时间（秒）。', 'Time of this keyframe or marker in seconds.');
  property('Key.value', 'Number / Array', '当前关键帧存储的值。', 'Value stored at this keyframe.');
  property('Key.index', 'Number', '关键帧或标记按时间排列的序号，从 1 开始。', 'Chronological keyframe or marker index, starting at 1.');
  property('Layer.anchorPoint Transform.anchorPoint', 'Property', '图层空间中的锚点坐标。', 'Anchor-point coordinates in layer space.');
  property('Layer.position Transform.position', 'Property', '图层位置；有父级时使用父级坐标系，否则使用世界坐标。', 'Layer position in parent space when parented, otherwise in world space.');
  property('Layer.scale Transform.scale', 'Property', '各轴的缩放百分比，100 为原始大小。', 'Scale percentage per axis; 100 is the original size.');
  property('Layer.rotation Transform.rotation Transform.zRotation', 'Property', '图层的旋转角度；3D 图层对应 Z 轴（度）。', 'Layer rotation in degrees; the Z axis for 3D layers.');
  property('Layer.opacity Transform.opacity', 'Property', '图层不透明度，范围通常为 0–100%。', 'Layer opacity, normally from 0 to 100 percent.');
  property('Layer.orientation Transform.orientation', 'Property', '3D 图层绕各轴的方向角（度）。', 'Orientation angles of a 3D layer in degrees.');
  property('Transform.xPosition', 'Property', '分离维度后的位置 X 分量。', 'X position component after separating dimensions.');
  property('Transform.yPosition', 'Property', '分离维度后的位置 Y 分量。', 'Y position component after separating dimensions.');
  property('Transform.zPosition', 'Property', '分离维度后的位置 Z 分量。', 'Z position component after separating dimensions.');
  property('Transform.xRotation', 'Property', '3D 图层绕 X 轴的旋转角度（度）。', '3D layer rotation around the X axis in degrees.');
  property('Transform.yRotation', 'Property', '3D 图层绕 Y 轴的旋转角度（度）。', '3D layer rotation around the Y axis in degrees.');
  property('Text.sourceText', 'SourceText', '文本内容属性，可继续读取 style 或调用 getStyleAt()。', 'Text content property; access style or call getStyleAt().');
  property('SourceText.value', 'String', '当前时间的文本字符串，不含样式设置。', 'Current text string without style settings.');
  property('SourceText.style', 'TextStyle', '文本样式对象，可继续设置字体、字号和颜色。', 'Text style object for font, size, color and other styling.');
  property('TextStyle.font', 'String', '文本所用字体的 PostScript 名称。', 'PostScript name of the text font.');
  property('TextStyle.fontSize', 'Number', '当前文本的字号。', 'Current text font size.');
  property('TextStyle.fillColor', 'Array[3]', '文字填充的 RGB 分量。', 'RGB components of the text fill color.');
  property('TextStyle.applyFill', 'Boolean', '文字填充是否启用。', 'Whether text fill is enabled.');
  property('TextStyle.applyStroke', 'Boolean', '文字描边是否启用。', 'Whether text stroke is enabled.');
  property('TextStyle.strokeColor', 'Array[3]', '文字描边的 RGB 分量。', 'RGB components of the text stroke color.');
  property('TextStyle.strokeWidth', 'Number', '文字描边宽度。', 'Text stroke width.');
  property('TextStyle.tracking', 'Number', '字符间距设置值。', 'Character tracking value.');
  property('TextStyle.leading', 'Number', '行与行之间的距离。', 'Distance between text lines.');
  property('TextStyle.autoLeading', 'Boolean', '自动行距是否启用。', 'Whether automatic leading is enabled.');
  property('Mask.maskOpacity', 'Property', '蒙版的不透明度百分比。', 'Mask opacity percentage.');
  property('Mask.maskFeather', 'Property', '蒙版各方向的羽化距离（像素）。', 'Mask feather distances in pixels.');
  property('Mask.maskExpansion', 'Property', '蒙版向内或向外扩展的距离（像素）。', 'Mask expansion distance in pixels.');
  property('Mask.maskPath', 'Path', '蒙版路径，可继续读取顶点和切线。', 'Mask path; access its vertices and tangents.');
  property('Mask.invert', 'Boolean', '蒙版是否反转。', 'Whether the mask is inverted.');
  var constants = {PI:['圆周率 π，约 3.14159。','Pi, approximately 3.14159.'], E:['自然常数 e，约 2.71828。','Euler’s number e, approximately 2.71828.'],
    LN2:['2 的自然对数。','Natural logarithm of 2.'], LN10:['10 的自然对数。','Natural logarithm of 10.'],
    LOG2E:['以 2 为底的 e 的对数。','Base-2 logarithm of e.'], LOG10E:['以 10 为底的 e 的对数。','Base-10 logarithm of e.'],
    SQRT1_2:['二分之一的平方根。','Square root of one half.'], SQRT2:['2 的平方根。','Square root of 2.']};
  Object.keys(constants).forEach(function (name) { property('Math.'+name,'Number',constants[name][0],constants[name][1]); });
  var keywords = {
    'var':['声明函数作用域变量。','Declare a function-scoped variable.'], 'let':['声明块作用域变量。','Declare a block-scoped variable.'],
    'const':['声明不可重新赋值的绑定。','Declare a binding that cannot be reassigned.'], 'function':['声明或创建函数。','Declare or create a function.'],
    'return':['结束函数并返回一个值。','End a function and return a value.'], 'if':['按条件执行语句。','Execute a statement when a condition is true.'],
    'else':['执行条件不成立时的分支。','Execute the alternative branch.'], 'for':['建立带初始化、条件和更新步骤的循环。','Create a loop with initialization, condition and update steps.'],
    'while':['条件成立时重复执行。','Repeat while a condition is true.'], 'do':['先执行一次循环体，再检查条件。','Execute the loop body before checking its condition.'],
    'break':['退出当前循环或 switch 语句。','Exit the current loop or switch statement.'], 'continue':['跳过本轮循环的剩余语句，进入下一轮。','Skip the rest of this loop iteration.'],
    'switch':['按表达式的值选择分支。','Select a branch based on an expression value.'], 'case':['定义 switch 的匹配分支。','Define a matching switch branch.'],
    'default':['定义 switch 未匹配其他分支时的操作。','Define the fallback switch branch.'], 'true':['布尔真值。','Boolean true.'], 'false':['布尔假值。','Boolean false.'],
    'null':['表示明确的空值。','Represent an explicit empty value.'], 'undefined':['表示尚未定义的值。','Represent an undefined value.'],
    'NaN':['表示无法得到有效数值的计算结果。','Represent a numeric result that is not a number.'], 'Infinity':['表示正无穷大。','Represent positive infinity.'],
    'try':['执行需要捕获异常的代码。','Run code whose exceptions can be caught.'], 'catch':['处理 try 中抛出的异常。','Handle an exception thrown in try.'],
    'finally':['在 try/catch 之后执行清理代码。','Run cleanup after try/catch.'], 'throw':['抛出异常。','Throw an exception.'],
    'new':['调用构造函数创建实例。','Create an instance using a constructor.'], 'typeof':['返回值的 JavaScript 类型字符串。','Return a value’s JavaScript type string.'],
    'instanceof':['检查对象的原型链是否包含指定构造函数的原型。','Check whether a constructor’s prototype occurs in an object’s prototype chain.']
  };
  Object.keys(keywords).forEach(function (name) { property('Keyword.'+name, 'JavaScript', keywords[name][0], keywords[name][1]); });

  function split(signature) {
    var text = signature.slice(1, -1), result = [], start = 0, depth = 0, quote = '';
    for (var i = 0; i < text.length; i++) {
      var char = text.charAt(i);
      if (quote) { if (char === '\\') i++; else if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '[' || char === '(' || char === '{') depth++;
      else if (char === ']' || char === ')' || char === '}') depth--;
      else if (char === ',' && !depth) { result.push(text.slice(start, i).trim()); start = i + 1; }
    }
    if (text.slice(start).trim()) result.push(text.slice(start).trim());
    return result;
  }
  function describe(entry, language) {
    var doc = docs[entry.owner + '.' + entry.name];
    if (!doc) return null;
    var en = language === 'en', lang = en ? 1 : 0, extra = doc.extra;
    if (entry.kind === 'property' || entry.kind === 'keyword') return {
      summary:doc.text[lang], count:(en ? 'Type: ' : '类型：')+extra.valueType,
      parameters:[], forms:[], note:'', allowedCounts:[]
    };
    if (entry.kind !== 'function') return null;
    var params = split(entry.params).map(function (part) {
      var equals = part.indexOf('='), name = (equals < 0 ? part : part.slice(0, equals)).trim();
      var info = extra.parameters && extra.parameters[name] || args[name];
      var optional = equals >= 0 || extra.variadic || (extra.optional || []).indexOf(name) >= 0;
      return {name:name, type:info ? info.type : '', description:info ? info.text[lang] : '', optional:!!optional,
        conditional:(extra.conditional || []).indexOf(name) >= 0,
        defaultValue:equals < 0 ? '' : part.slice(equals + 1).trim()};
    });
    var required = params.filter(function (param) { return !param.optional; }).length;
    var forms = extra.forms || [], counts = extra.allowedCounts || forms.map(function (form) { return form[1]; });
    var range = required === params.length ? String(required) : required + '–' + params.length;
    if (counts.length) range = extra.trailingOptional ? counts[0] + '–' + counts[counts.length-1] : counts.join(en ? ' or ' : ' 或 ');
    var count = extra.variadic ? (en ? 'Accepts 0 or more arguments' : '可传 0 个或更多参数') :
      (en ? 'Accepts ' + range + ' arguments' : '可传 ' + range + ' 个参数');
    return {summary:doc.text[lang], parameters:params, count:count, note:extra.note ? extra.note[lang] : '', allowedCounts:counts,
      forms:forms.map(function (form) {
      var extraNames = split(form[0]).filter(function (name) { return !params.some(function (param) { return param.name === name; }); });
      return entry.name + form[0] + (extraNames.length ? '\n' + extraNames.map(function (name) { return name + ': ' + args[name].text[lang]; }).join('\n') : '');
    }),
      source:entry.owner === 'Math' || entry.owner === 'JSON' || /^(parseInt|parseFloat|isNaN|isFinite)$/.test(entry.name) ? 'JavaScript' : 'Adobe'};
  }
  return {describe:describe};
})();
