游戏引擎提供了便捷的界面编辑器，但是程序员们还是千方百计地想要把摆放界面的效率提高，异名也做了一个有趣的尝试给大家分享。
<!-- more -->

在游戏界面的搭建这一块，行业内有很多成熟的工作流，有像`animate.cc`和`create.js`这种完全把界面和交互交给设计的方案，也有像`FairyGUI`这些面向设计师的跨平台的界面编辑器，有基于引擎界面编辑器的组件化方案，也有利用引擎的插件系统把设计背景图引入作为布局参考的便利方案。从库的开发到封装的界面编辑器，其实我们的游戏界面搭建效率已经很高了，但是从设计稿直出，业内也一直没有停止过尝试，一些比较主流的引擎像`laya`、`unity`都有相关的设计稿生成画面的插件，异名这次就利用`sketch`的工具链来实现一个`sketch2cocos`的界面搭建插件。
![自动生成界面](http://cdn.blog.ifengzp.com/sketch2cocos/demo.gif)

`Sketchtool`是`Sketch`附带的命令行工具，我们可以利用`sketchtool`对`Sketch`文档执行某些操作，比如读取设计稿的图层节点、导出资源等

```js
const execSync = require("child_process").execSync;
const BINARY_PATH = "/Applications/Sketch.app/Contents/Resources/sketchtool/bin/sketchtool";

// 读取稿子的图层信息
const scheme = execSync(`${BINARY_PATH} list layers ./test.sketch`).toString();
console.log(scheme)
```
![获取sketch结构](http://cdn.blog.ifengzp.com/sketch2cocos/1.png)

也可以利用sketchtool进行资源以及指定资源的导出

```js
const execSync = require("child_process").execSync;
const BINARY_PATH = "/Applications/Sketch.app/Contents/Resources/sketchtool/bin/sketchtool";

// 导出画板artboards、页面pages、切片slices等
execSync(`${BINARY_PATH} export pages ./test_sketch.sketch --output=./output`);

// 根据图层id，精确导出某一个图层
const itemId = "8F64B8D9-21BB-4202-984E-488DB00A381E";
execSync(`${BINARY_PATH} export layers ./test_sketch.sketch --output=./output --item=${itemId}`);
```
![导出资源](http://cdn.blog.ifengzp.com/sketch2cocos/1.gif)

因为sketchtool是和sketch强关联的，所以不同版本的sketchtool和sketch可能会存在不兼容的情况，所以并不建议把sketchtool当成单独的依赖，而是应该引用用户本地sketch安装路径里面的sketchtool。另外GitHub上有很多封装好的sketchtool读取工具，比如`node-sketch`等，但是涉及到资源导出，还是离不开sketchtool，这一块异名目前还没发现有功能支持比较完整的轮子，有兴趣的同学可以封装一下。

有了设计稿的结构描述文件+资源，接下来要在引擎的界面编辑器上还原就比较简单了，这里有两种方式，*一种是直接转换，把设计稿的`scheme`描述文件转换成引擎界面编辑器的`fire`描述文件*，引擎生成界面描述语言这部分源码并没有开源，需要我们自己去做对比和转换会很费精力，而且不好维护；*第二种方式就是利用引擎提供的编辑器扩展功能，在插件的运行进程去调用引擎的面板进程，递归遍历`scheme`然后动态地往场景内插入节点，从而把界面还原出来*。异名这次的演示就是基于第二种，两个进程间简单的信息流如下：

![获取sketch结构](http://cdn.blog.ifengzp.com/sketch2cocos/2.png)

进程间的通信是通过引擎暴露的IPC机制，其实就是在插件进程里把资源处理好，然后在面板进程里面加载资源并递归插入节点，这部分的代码如下：

```js
/**
 * 添加节点到画面中
 * @param {*} parent 父节点
 * @param {*} node 要插入的节点
 */
function addNodeToScene(parent, node) {
  const { id, props, children } = node;
  const { width, height } = props.style;
  const { x, y, source } = props.attrs;

  const ccNode = new cc.Node();
  ccNode.name = id;
  ccNode.width = width;
  ccNode.height = height;
  ccNode.x = x;
  ccNode.y = y;

  parent ? parent.addChild(ccNode) : cc.find('Canvas').addChild(ccNode);

  if (source) {
    
    const dbPath = source.match(/\w+.png$/)[0];

    cc.resources.load(dbPath, cc.SpriteFrame, (err, spriteFrame) => {
      const sprite = ccNode.addComponent(cc.Sprite);
      sprite.spriteFrame = spriteFrame;
    });
  }

  children.forEach((child) => addNodeToScene(ccNode, child));
}
```

完整的demo代码可以点击原文跳转查看，这是一个演示级别的demo，只做了节点和sprite的映射生成，有兴趣的读者可以自行扩展。demo中并没有实现sketch生成JSON这一步，而是直接读取了一份给定的`scheme`（第三方工具生成），可能大家会有些疑问，文章开头提到了`sketchtool`可以读取设计稿的节点信息，那直接递归遍历节点不就可以生成对应的描述文件了吗？

对于游戏开发这个场景来说，因为在游戏中的基本单位是`sprite`，所以对设计稿的读取要求会比较低，只需要准确生成图片并导出就可以了，所以很多`psdToXX`、`sketchToXX`插件都是这样粗暴实现的，但是这也造成了这类插件的界面还原度很低，并不能在生产环境中使用。因为简单的设计稿结构读取和导出是不能满足需求的，最直接的就是设计稿上会有大量的*节点的冗余*，因为稿子中也保存了设计师创作的一些中间过程，比如大量的路径和未合并的图层，在导出的时候需要做甄别，同时设计师在创作的时候也需要按照一定规范去*约束层级关系*，或者通过标记的方式给节点打标签等等，除了创作规范之外，还存在一些识别问题，比如图层的大小不包括阴影，精灵图层在切图之后的盒子宽高大小如何同步等等，这些细节的落地需要做更多的规范和程序处理。虽然这种这种设计稿还原方式比较粗暴，但是在一些游戏场景比较简单又需要大批量生产的绘本游戏中，这套工作流规范一下还是有它的应用场景，我们可以参考一下行业内的标兵是如何是落地的。

最近几年前端有一个很前沿的方向就是前端智能化，就是通过`AI/CV`技术，使前端工具链具备理解能力，进而辅助开发提升研发效率，其中基于设计稿智能布局和组件智能识别就是其中一个。在上周的腾讯TLC大会上，异名了解到淘系的`imgcook`已经在阿里落地并且产生了很大的业务价值，它已经开源了一套设计约束规范和对应的sketch插件，异名demo中的`scheme`就是通过`imgcook`导出的。

![imgcook链路拆解](http://cdn.blog.ifengzp.com/sketch2cocos/3.png)

但是对游戏而言，我们可能不需要这么细颗粒的设计稿识别，比如圆角按钮，在游戏中应该就是一个圆角矩形的`sprite`，但是通过`imgcook`的识别可能并不会提取成图片，因为对于web而言用css实现才是规范的做法。imgcook也提供`DSL`的扩展，支持用户自定义语言，如果有一天看到有小伙伴支持了真正（高识别度，高还原度）的一键式`sketch2cocos`工具，那肯定是一件很棒的事情