/* Local script discovery. The image directory is always relative to the selected root. */
AELocalToolkit.launcher = (function () {
  var scanned = {};
  // Inputs are native fsName paths. ExtendScript constructors decode %xx even
  // in Windows paths; escape literal percentages before crossing that boundary.
  function nativePath(path) { return String(path).replace(/%/g, '%25'); }
  function identity(file) { return Folder.fs === 'Windows' ? file.fsName.toLowerCase() : file.fsName; }
  function nativeName(file) { return file.fsName.replace(/^.*[\\\/]/, ''); }
  function browserFileUrl(file) {
    var path = file.fsName.replace(/\\/g, '/');
    // ExtendScript absoluteURI (/d/...) is not a browser URL. Encode the native path once.
    var encoded = encodeURI(path).replace(/#/g, '%23').replace(/\?/g, '%3F');
    return path.indexOf('//') === 0 ? 'file:' + encoded : (path.charAt(0) === '/' ? 'file://' : 'file:///') + encoded;
  }
  function imageFinder(root) {
    var cache = {}, extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    function find(folder, stem) {
      var key = identity(folder), index = cache[key];
      if (!index) {
        index = {}; cache[key] = index;
        var files = folder.exists ? folder.getFiles() : [];
        for (var i = 0; i < files.length; i++) {
          if (files[i] instanceof Folder) continue;
          var name = nativeName(files[i]), dot = name.lastIndexOf('.');
          var extension = name.slice(dot + 1).toLowerCase(), rank = -1;
          for (var j = 0; j < extensions.length; j++) if (extensions[j] === extension) { rank = j; break; }
          if (rank < 0) continue;
          var imageKey = '$' + name.slice(0, dot).toLowerCase();
          if (!index[imageKey] || rank < index[imageKey].rank) index[imageKey] = {file:files[i], rank:rank};
        }
      }
      var result = index['$' + stem.toLowerCase()];
      return result ? result.file : null;
    }
    return function (file, relative) {
      var stem = nativeName(file).replace(/\.(jsx|jsxbin)$/i, '');
      var slash = relative.lastIndexOf('/');
      var directory = slash >= 0 ? relative.slice(0, slash) : '';
      var imageRoot = root.fsName + '/image';
      var image = find(new Folder(nativePath(imageRoot + (directory ? '/' + directory : ''))), stem) ||
        (directory ? find(new Folder(nativePath(imageRoot)), stem) : null) || find(file.parent, stem);
      return image ? browserFileUrl(image) : '';
    };
  }
  function scanScripts(path) {
    var result = { ok:true, scripts:[], messages:[] }, root = new Folder(nativePath(path));
    scanned = {};
    try {
      if (!root.exists) throw new Error('脚本文件夹不存在：' + path);
      var imageFor = imageFinder(root), stack = [{folder:root, depth:0}], visited = {}, count = 0;
      while (stack.length) {
        var entry = stack.pop(), folder = entry.folder;
        if (folder.alias) folder = folder.resolve();
        if (!folder) continue;
        var key = identity(folder);
        if (visited[key]) continue;
        visited[key] = true;
        if (entry.depth > 24) { result.messages.push('已跳过超过 24 层的目录：' + folder.fsName); continue; }
        var items = folder.getFiles();
        for (var i = 0; i < items.length; i++) {
          if (++count > 20000) throw new Error('目录超过 20000 项，请选择更具体的脚本文件夹。');
          var file = items[i], name = nativeName(file);
          if (file instanceof Folder) {
            if (!/^\(.*\)$/.test(name) && name.toLowerCase() !== 'image') stack.push({folder:file,depth:entry.depth+1});
            continue;
          }
          if (!/\.(jsx|jsxbin)$/i.test(name)) continue;
          var relative = file.fsName.substr(root.fsName.length + 1).replace(/\\/g, '/');
          result.scripts.push({name:name.replace(/\.(jsx|jsxbin)$/i,''),relativePath:relative,fsName:file.fsName,iconPath:imageFor(file,relative)});
          scanned[identity(file)] = true;
        }
      }
      result.scripts.sort(function (a,b) { var x=a.relativePath.toLowerCase(),y=b.relativePath.toLowerCase(); return x<y?-1:x>y?1:0; });
    } catch (e) { scanned={}; result.ok=false; result.messages.push(String(e)); }
    return result;
  }
  function launchScript(path) {
    try {
      var file = new File(nativePath(path));
      if (!/\.(jsx|jsxbin)$/i.test(nativeName(file)) || !scanned[identity(file)]) throw new Error('请先扫描并选择脚本。');
      if (!file.exists) throw new Error('脚本文件已移动或删除，请刷新列表。');
      $.evalFile(file);
      return {ok:true};
    } catch (e) { return {ok:false,messages:[String(e)]}; }
  }
  return {scanScripts:scanScripts,launchScript:launchScript};
})();
