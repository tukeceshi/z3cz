# Realistic Cinematic Story-to-Video Skill

## Skill Name

`realistic-cinematic-story-to-video`

## Purpose

将小说、剧本、故事梗概或场景描述转换为：

**小说文本 → 场景拆解 → 电影化分镜 → 连续镜头 → AI视频Prompt**

最终输出的视觉效果必须接近：

> 真实电影摄影机拍摄的影视素材

而不是：

> AI插画、游戏CG、概念艺术、宣传海报或过度风格化的视频。

---

# 1. Core Mission

本 Skill 的核心任务不是简单“把文字翻译成画面”。

而是模拟一名完整的影视制作团队：

- 编剧负责理解剧情
- 导演负责安排表演
- 摄影指导负责镜头
- 灯光指导负责光线
- 美术指导负责环境
- 服化道负责人物细节
- 剪辑师负责镜头衔接
- AI Video Prompt Designer 负责最终生成提示词

因此，处理小说时必须先理解：

**“这一段剧情实际上需要拍什么？”**

再决定：

**“应该怎么拍？”**

最后才生成：

**“应该怎样写给视频模型？”**

---

# 2. Workflow

默认执行以下流程：

## Step 1：剧情理解

读取小说原文，提取：

- 时间
- 地点
- 人物
- 人物年龄
- 人物关系
- 当前状态
- 主要动作
- 情绪
- 对话
- 关键道具
- 环境变化
- 剧情信息
- 伏笔
- 潜在视觉线索

不要直接生成 Prompt。

---

# 3. Scene Breakdown

将原文拆成独立的影视场景。

场景判断依据：

### 时间发生明显变化

例如：

> 下午 → 夜晚

### 地点发生变化

例如：

> 教室 → 操场 → 家里

### 核心人物发生变化

例如：

> 童童独处 → 老师出现

### 剧情阶段发生变化

例如：

> 平静等待 → 发现异常 → 情绪变化

每个场景必须具有明确的：

**开始状态 → 发展 → 变化 → 结束状态**

---

# 4. Visual Story Bible

在开始生成镜头之前，建立：

## Character Bible

每个主要角色建立固定档案：

### Example

**角色：童童**

- Age: 8
- Gender: Female
- Hair: shoulder-length black hair
- Hairstyle: simple natural ponytail
- Face: childlike natural facial proportions
- Clothing: slightly worn school uniform
- Backpack: small dark-colored backpack
- Personality: quiet, observant, restrained
- Acting style: subtle and natural

后续所有镜头必须遵循该设定。

不得无原因改变：

- 年龄
- 发型
- 衣服
- 背包
- 身材比例
- 面部特征

---

# 5. Environment Bible

每个重要地点建立固定环境档案。

例如：

## Old School Building

- old red-brick exterior
- faded paint
- narrow concrete steps
- aging metal windows
- weathered walls
- scattered fallen leaves
- slightly dusty atmosphere
- nearby schoolyard
- realistic late-afternoon sunlight

之后该地点再次出现时，保持：

- 建筑结构
- 门窗位置
- 道路关系
- 道具
- 空间尺度
- 色彩
- 光照逻辑

一致。

---

# 6. Time Continuity

必须建立明确时间线。

例如：

> 16:30\
> 16:40\
> 16:55\
> 17:20\
> 18:10

任何连续镜头都不得出现无理由时间跳跃。

尤其注意：

- 阳光角度
- 天空亮度
- 人物影子长度
- 环境色温
- 衣服变化
- 建筑灯光

必须与时间匹配。

---

# 7. Shot Design

小说中的一个完整动作，不应该默认只生成一个镜头。

应根据电影叙事需要拆分为：

### Establishing Shot

建立空间。

### Wide Shot

展示人物和环境关系。

### Medium Shot

展示人物动作。

### Medium Close-Up

展示人物状态和情绪。

### Close-Up

展示重要情绪。

### Extreme Close-Up

展示关键细节。

### Insert Shot

展示关键物件。

例如：

小说：

> 童童坐在废弃红砖楼的台阶上看夕阳。

可拆成：

**镜头 01：**

学校和废弃红砖楼的远景。

**镜头 02：**

童童独自坐在台阶上的全景。

**镜头 03：**

童童抬起手，用手指挡住夕阳。

**镜头 04：**

从童童视角看橘红色的太阳。

**镜头 05：**

童童眼睛的近景。

**镜头 06：**

远处空荡荡的校门。

这样才能形成真正的电影段落。

---

# 8. Shot Duration

根据剧情确定镜头时长。

### Establishing

4–8 seconds

### Character Action

3–6 seconds

### Dialogue

3–8 seconds

### Emotional Close-Up

3–5 seconds

### Suspense

5–10 seconds

不要所有镜头都固定成相同长度。

---

# 9. Camera Language

每一个镜头都必须明确：

- Shot size
- Camera height
- Camera angle
- Focal length
- Camera movement
- Subject position
- Focus
- Depth of field

例如：

> Medium close-up, eye-level camera, 50mm cinema lens, subtle handheld movement, shallow but natural depth of field, the girl positioned slightly off-center.

不要只写：

> cinematic camera

---

# 10. Camera Movement Rules

镜头运动必须有叙事目的。

### Static

适合：

- 等待
- 孤独
- 压迫感
- 观察

### Slow Push-In

适合：

- 情绪变化
- 发现秘密
- 紧张

### Tracking Shot

适合：

- 跟随人物
- 行走
- 追逐

### Handheld

适合：

- 现实主义
- 紧张
- 混乱
- 纪录片感

### Slow Pan

适合：

- 展示空间
- 发现人物
- 信息揭示

不要为了“电影感”随机移动摄影机。

---

# 11. Camera Continuity

镜头之间必须保持：

### 180-Degree Rule

除非明确需要越轴，否则保持人物空间方向一致。

### Eyeline

人物看向某处时：

下一镜头应该给出合理的视线对象。

### Screen Direction

人物从左向右移动：

下一镜头不能无原因突然从右向左。

### Lighting Direction

上一镜头光线来自左侧：

下一镜头人物脸部不能无原因变成右侧主光。

---

# 12. Human Acting

人物动作必须像真实演员。

例如：

不要：

> girl dramatically turns around

优先：

> the girl slowly turns her head after hearing a faint sound, her expression remaining restrained

不要：

> terrified expression

优先：

> her breathing becomes slightly shallower, her eyes shift toward the sound, and her expression becomes subtly tense

使用：

- micro-expression
- eye movement
- breathing
- hesitation
- slight posture change
- natural blinking
- restrained gestures

---

# 13. Dialogue Scene

对话场景自动建立镜头覆盖。

默认结构：

### Shot A

Two-shot

展示双方空间关系。

### Shot B

Over-the-shoulder

人物 A → 人物 B。

### Shot C

Reverse over-the-shoulder

人物 B → 人物 A。

### Shot D

Close-up

重要情绪。

### Shot E

Reaction Shot

另一人物的反应。

不要让角色一直面对摄影机说话。

---

# 14. Emotion Escalation

情绪必须逐级变化。

例如：

**平静**

→

**疑惑**

→

**察觉异常**

→

**不安**

→

**紧张**

→

**恐惧**

不要从平静直接跳到夸张恐惧。

镜头也应该同步变化：

Wide

→

Medium

→

Medium Close-Up

→

Close-Up

→

Extreme Close-Up

---

# 15. Suspense Mode

悬疑场景重点不是加入恐怖特效。

优先使用：

- empty space
- silence
- delayed reaction
- off-screen sound implication
- long static shot
- distant figure
- partially obscured object
- unusual environmental detail
- restrained lighting

例如：

> The camera remains still as the girl continues waiting, while an empty corridor behind her remains slightly out of focus.

这种方式比突然出现怪物更具有现实电影感。

---

# 16. Horror / Thriller Visual Rules

禁止无意义加入：

- blood
- monsters
- glowing eyes
- supernatural effects
- impossible shadows
- excessive fog
- aggressive lens effects

除非原故事确实需要。

优先使用：

**现实环境 + 异常细节 + 留白 + 镜头观察**

制造紧张感。

---

# 17. Lighting Continuity

每个场景建立 Light Bible。

例如：

### Scene

Late afternoon.

### Main Light

Sunlight from camera left.

### Fill

Soft ambient skylight.

### Shadow

Long soft shadows.

### Color

Warm daylight with slightly cool ambient shadows.

后续镜头必须保持一致。

---

# 18. Weather Continuity

如果场景开始时：

> cloudy afternoon

后续镜头不能突然：

> bright sunny sky

除非剧情明确发生天气变化。

必须保持：

- cloud density
- rainfall
- wet surfaces
- wind
- clothing response
- light intensity

一致。

---

# 19. Physical Realism

任何动态必须符合：

- gravity
- inertia
- friction
- weight
- momentum
- collision
- realistic human anatomy

例如：

人物跑步时：

- 身体重心变化
- 手臂自然摆动
- 衣服跟随运动
- 头发受到惯性影响

不能出现：

- floating feet
- sliding movement
- impossible body rotation
- teleportation
- object deformation without cause

---

# 20. AI Video Artifact Prevention

生成 Prompt 时主动避免：

- face morphing
- identity drift
- changing clothes
- changing hairstyle
- extra limbs
- extra fingers
- object duplication
- background deformation
- unstable architecture
- flickering lighting
- random camera movement
- unnatural walking
- melting textures

对于人物：

> consistent facial identity, consistent clothing, consistent hairstyle, stable body proportions

对于环境：

> stable architecture, consistent environmental geometry, unchanged background structure

---

# 21. Single Shot Prompt

每一个镜头最终转换成以下结构：

## Shot Prompt

**Scene**

时间 + 地点 + 环境。

**Character**

人物固定外观。

**Action**

当前动作。

**Emotion**

当前情绪。

**Camera**

景别 + 机位 + 焦段。

**Movement**

摄影机运动。

**Lighting**

光源与阴影。

**Composition**

人物位置和空间关系。

**Physics**

人物和环境的真实运动。

**Visual Style**

写实电影摄影。

---

# 22. Standard Prompt Formula

默认输出：

> A highly realistic cinematic scene of \[CHARACTER\] in \[LOCATION\] at \[TIME\].
>
> \[CHARACTER CONSISTENCY DESCRIPTION\].
>
> The character is \[ACTION\], showing \[SUBTLE EMOTION\].
>
> The environment contains \[ENVIRONMENT DETAILS\], maintaining consistent architecture and spatial proportions.
>
> Shot on a professional cinema camera with a \[LENS\] lens, \[SHOT SIZE\], \[CAMERA ANGLE\], \[CAMERA MOVEMENT\].
>
> Lighting comes naturally from \[LIGHT SOURCE\], creating \[SHADOW AND COLOR CHARACTERISTICS\].
>
> The character remains consistent with previous shots in facial identity, hairstyle, clothing, body proportions and accessories.
>
> Natural human movement, realistic physics, natural fabric motion, realistic environmental interaction.
>
> Photorealistic cinematic cinematography, authentic skin texture, natural imperfections, realistic materials, restrained color grading, subtle film grain, realistic highlight roll-off, physically plausible lighting, no artificial posing.

---

# 23. Negative Prompt

统一加入：

> cartoon, anime, illustration, painting, 3D render, CGI, game art, fantasy art, plastic skin, porcelain skin, excessive beauty retouching, deformed anatomy, distorted face, changing identity, changing clothes, changing hairstyle, extra fingers, extra limbs, duplicate objects, unstable architecture, background deformation, flickering lighting, artificial movement, unnatural walking, sliding feet, floating objects, teleportation, unrealistic reflections, excessive bloom, excessive lens flare, extreme HDR, oversaturated colors, excessive sharpening, extreme bokeh, fake cinematic effects

---

# 24. Novel-to-Storyboard Output

当用户提供小说章节时，默认按照以下格式处理：

## Scene 01

**时间：**

**地点：**

**剧情目的：**

**人物：**

**环境：**

**情绪：**

---

### Shot 01

**Duration:** 5 sec

**Shot Type:** Establishing Wide Shot

**Camera:** 35mm, eye-level

**Movement:** Slow push-in

**Action:**

**Lighting:**

**Composition:**

**Video Prompt:**

---

### Shot 02

**Duration:** 4 sec

**Shot Type:** Medium Shot

**Camera:** 50mm

**Movement:** Static

**Action:**

**Emotion:**

**Lighting:**

**Composition:**

**Video Prompt:**

---

### Shot 03

**Duration:** 4 sec

**Shot Type:** Close-Up

**Camera:** 85mm

**Movement:** Very subtle handheld

**Action:**

**Emotion:**

**Lighting:**

**Video Prompt:**

---

# 25. Editing Rhythm

根据剧情自动调整剪辑节奏。

### Calm

5–8 sec per shot

### Normal Dialogue

3–6 sec

### Suspense

5–10 sec

### Emotional Climax

2–5 sec

### Action

1–4 sec

### Reveal

可以短暂延长镜头。

---

# 26. Invisible Information

小说中的一些信息不能直接拍出来。

例如：

> “她知道父亲不会来了。”

不要直接生成文字：

> she knows her father will never come

而应该视觉化为：

- 她看了一眼空荡荡的道路
- 再看了一眼手机
- 放下手机
- 没有再继续等待
- 表情发生轻微变化

即：

**抽象文字 → 可观察行为**

---

# 27. Narration Conversion

旁白必须转换成视觉语言。

例如：

小说：

> 时间一点点过去，天渐渐黑了。

转换：

> The sunlight slowly fades from the schoolyard. The long shadows disappear into the cool evening light as the entrance gradually becomes empty.

---

# 28. Symbolic Objects

小说中的重要物件可以成为视觉叙事中心。

例如：

- old photograph
- school badge
- backpack
- broken watch
- key
- notebook
- toy
- umbrella

当物件承载剧情意义时，可以单独建立：

**Insert Shot**

并保持该物件在之后镜头中的外观一致。

---

# 29. Character Introduction

角色第一次出现时：

优先：

**环境 → 人物 → 动作 → 细节**

不要直接：

> beautiful girl close-up

例如：

> The camera slowly reveals a small girl sitting alone on the steps of an old red-brick building, her school backpack resting beside her.

让观众先理解：

**她在哪里**

再理解：

**她是谁**

最后看到：

**她的情绪。**

---

# 30. Scene Transition

场景之间优先使用自然电影剪辑：

- match cut
- visual match
- sound bridge
- movement transition
- environmental transition
- temporal dissolve

例如：

夕阳：

→

街灯亮起。

可以形成自然的时间过渡。

不要默认使用：

> dramatic transition effect

---

# 31. Multi-Shot Consistency Lock

当一段故事需要连续生成多个视频时，在每个 Prompt 前加入：

### Character Lock

固定：

> Same character as previous shot.

### Costume Lock

> Same clothing and accessories as previous shot.

### Location Lock

> Same location and architectural layout as previous shot.

### Lighting Lock

> Same lighting direction and weather conditions as previous shot.

### Cinematography Lock

> Same cinema camera system and visual language as previous shot.

这样可以最大限度降低不同视频片段之间的跳变。

---

# 32. Director Mode

当用户说：

> “把这一章做成电影。”

自动执行：

**第一阶段：**

分析章节剧情。

**第二阶段：**

创建 Character Bible。

**第三阶段：**

创建 Environment Bible。

**第四阶段：**

建立 Timeline。

**第五阶段：**

拆分 Scene。

**第六阶段：**

拆分 Shot。

**第七阶段：**

设置镜头语言。

**第八阶段：**

设置人物表演。

**第九阶段：**

设置灯光与色彩。

**第十阶段：**

生成 AI Video Prompt。

---

# 33. Default Cinematic Style

当用户没有指定视觉风格时，默认：

> grounded contemporary realism, natural cinematic photography, restrained color palette, realistic skin texture, authentic environmental details, natural practical lighting, physically plausible shadows, subtle film grain, realistic optical characteristics, restrained depth of field, natural camera movement, realistic human performance

---

# 34. Default Film Grammar

默认采用：

**现实主义电影 + 克制摄影 + 自然表演 + 低调灯光 + 真实空间 + 叙事性构图**

除非用户另行指定：

- 商业大片
- 黑色电影
- 港片
- 日系电影
- 韩式悬疑
- 美式犯罪片
- 纪录片
- 恐怖片
- 科幻片
- 年代片

等特殊视觉风格。

---

# 35. Quality Check

生成最终镜头前，必须自动检查：

### Story

- 是否符合原剧情？
- 是否遗漏关键行为？
- 是否改变人物意图？

### Character

- 年龄是否一致？
- 外貌是否一致？
- 衣服是否一致？
- 动作是否符合人物性格？

### Environment

- 场景是否一致？
- 建筑结构是否一致？
- 时间是否合理？

### Camera

- 镜头是否真正可拍？
- 焦段是否合理？
- 景别是否合适？
- 运动是否必要？

### Lighting

- 光源是否真实？
- 光线方向是否连续？
- 时间与光照是否一致？

### Video

- 人物是否可能出现身份漂移？
- 背景是否容易变形？
- 动作是否符合物理规律？
- 是否存在 AI 常见伪影？

---

# 36. Final Principle

这个 Skill 最重要的一条规则：

> **不要把小说直接“画出来”。**

而是：

> **先理解故事，再把故事变成电影。**

最终结果应该让观众感觉：

**这是一个真实摄影团队拍摄的电影镜头。**

而不是：

**这是 AI 根据小说生成的一张漂亮图片。**

---

# 37. Recommended Pipeline

最终推荐工作流：

**小说**

↓

**剧情分析**

↓

**人物圣经**

↓

**场景圣经**

↓

**时间线**

↓

**场景拆解**

↓

**电影分镜**

↓

**镜头连续性检查**

↓

**单镜头 Video Prompt**

↓

**AI 视频生成**

↓

**镜头一致性检查**

↓

**重新生成问题镜头**

↓

**剪辑**

↓

**最终电影片段**

---

# 38. Example

输入：

> 夕阳下，8岁的童童一个人坐在学校旁边废弃红砖楼的台阶上，她抬起手挡住阳光。一个女老师走过来问她为什么还没回家。童童说，她没有妈妈，她在等爸爸。

输出应该自动形成：

### Scene

**Late afternoon / abandoned red-brick building beside a school**

### Shot 01

远景建立学校和废弃红砖楼。

### Shot 02

童童独自坐在台阶。

### Shot 03

童童抬手挡住夕阳。

### Shot 04

太阳透过手指的主观镜头。

### Shot 05

女老师从画面外进入。

### Shot 06

老师站在童童身旁。

### Shot 07

老师轻声询问。

### Shot 08

童童抬头。

### Shot 09

童童回答。

### Shot 10

老师表情产生极细微变化。

### Shot 11

童童重新看向远处道路。

### Shot 12

空荡的道路与逐渐下沉的夕阳。

最终通过这些镜头完成：

**等待 → 相遇 → 对话 → 信息揭示 → 情绪变化 → 留白**

而不是简单把整段小说生成成一个视频。

---

# 39. Default Output Language

用户使用中文时：

- 分镜说明使用中文。
- 人物和剧情分析使用中文。
- 最终 Video Prompt 默认使用英文。
- 可以额外附带中文镜头说明。

原因：

英文通常更方便兼容多数国际 AI 视频模型。

---

# 40. Final Output Format

最终输出严格保持：

**【场景信息】**

**Scene 01 — 场景名称**

时间：

地点：

剧情功能：

人物：

环境：

情绪：

---

**【镜头 01】**

景别：

镜头：

焦段：

运动：

人物：

动作：

表演：

灯光：

构图：

时长：

**Video Prompt：**

> English prompt

**Negative Prompt：**

> English negative prompt

然后继续：

**【镜头 02】**

……

直到完成整个场景。