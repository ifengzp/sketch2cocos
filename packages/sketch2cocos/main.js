const request = require("request");
const async = require("async");
const fs = require("fs");
const path = require("path");
const schema = require("./schema.json");

let newSceneLock = false;

/**
 * 从 schema 下载图片到本地
 * @param {*} cb 回调
 */
function downloadImgToLocal(cb) {
  const links = JSON.stringify(schema).match(/(https.+?png)/g);
  const texturePath = path.join(__dirname, "./../../assets/resources/");
  const reqs = links.map((link) => {
    return (cb) =>
      request({
        host: "https://ai-sample.oss-cn-hangzhou.aliyuncs.com",
        family: 4,
        url: link,
      })
        .on("error", (err) => {
          Editor.log(err);
        })
        .pipe(fs.createWriteStream(texturePath + link.match(/\w+.png$/)[0]))
        .on("close", cb);
  });
  async.parallel(reqs, (err, res) => {
    if (err) {
      Editor.log(err);
      return;
    }
    Editor.assetdb.refresh("db://assets/resources/", () => {
      cb();
    });
  });
}

/**
 * 开始转换
 * - 下载所有图片到本地
 * - 新建场景
 * @param {*} cb 回调
 */
function convertStart() {
  Editor.log("sketch2cocos：正在转换....");

  downloadImgToLocal(() => {
    newSceneLock = true;
    Editor.Ipc.sendToPanel('scene', 'scene:new-scene');
  });
}

/**
 * 新建场景后的回调
 * - 调用 scene-walker 往场景递归插入节点
 * @param {*} cb 回调
 */
function sceneInitCb() {
  newSceneLock = false;
  Editor.Scene.callSceneScript(
    "sketch2cocos",
    "add-nodes-to-scene",
    schema,
    (err, length) => {
      Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save');
      Editor.log("sketch2cocos：生成场景成功 💐💐💐💐💐💐💐💐");
    }
  );
}

module.exports = {
  messages: {
    open() {
      convertStart();
    },
    "scene:ready"() {
      newSceneLock && sceneInitCb();
    },
  },
};
