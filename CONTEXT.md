# OneBot WebQQ UI

This context defines the project-specific language for the floating WebQQ capsule in the Koishi console.

## Language

**主胶囊**:
Koishi 控制台右下角的浮动 WebQQ 入口外壳，承载当前机器人头像和摘要信息。
_Avoid_: 大胶囊, 外层按钮

**头像小胶囊**:
主胶囊中包住机器人头像或头像栈的左侧区域，是头像与主胶囊圆角关系的视觉参照。
_Avoid_: 左侧容器, 头像区域

**胶囊摘要文字**:
主胶囊右侧显示机器人昵称和当前状态的两行文字，整体应与头像小胶囊在垂直方向保持等距对齐。
_Avoid_: 右侧文字, 正文区域

**等距内缩**:
头像小胶囊中的头像对齐规则，头像左侧留白应与上下留白一致。
_Avoid_: 视觉居中, 只调高度
