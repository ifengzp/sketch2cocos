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

module.exports = {
  "add-nodes-to-scene": function (event, schema) {
    addNodeToScene(null, schema);
    event.reply && event.reply();
  },
};
