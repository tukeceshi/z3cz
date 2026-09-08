# 角色一致性资产工作流 3.0（中文发布版）

本 Skill 构建可复用的写实角色资产：中文确认，交付英文 Prompt。能创建模型节点时须核对显示名；不能绑定时只交付 Prompt，不能声称已调用。

## 五类主模式与模型路线

- **Mode 0 定脸：** Lib navo pro 直出，或 Lib Image／Style Image V8.2 候选后由 Lib navo pro 建卡。
- **Mode 1 服装定妆：** 使用 Lib navo pro 建立单张全身服装基准；必要时用 Lib Image 制作 Mode 1B 造型细节卡。
- **Mode 2 角色表：** Lib navo pro 三格：无头正面、带头背面、唯一正脸锚点。
- **Mode 3 高精度面部特写：** 使用 Lib Image 制作脸部、肩上或胸像细节参考。
- **Mode 4 两参考图换装：** 使用 Lib navo pro；第一张图提供服装与姿势，第二张图提供人物身份。

## 权威默认值

- 默认写实摄影；其他风格须明确要求。
- Mode 0 正式卡、Mode 1 单步、Mode 2 使用 18% 中性灰与 Flat Grade；候选不追加；白底仅按明确要求替换。

## 总工作流

### 1. 先确认角色状态

状态不明时问：**“角色已经有稳定参考图，还是要从零建立？”** 已说明则不重复问。

- 已有角色：上传参考图，回述身份特征并确认。
- 新角色：先确认文字规格，再进 Mode 0。

新角色规格：脸部骨相、眼形眼色、眉鼻唇、肤色肤质、头发、体型比例、默认表情、永久纹身及位置、疤痕、美人痣、固定穿孔。候选路线可把未定脸部项标为“探索轴”，但共享不变量须确认。妆面、美甲和可替换首饰在 Mode 1 锁定；标志性常戴配饰在 Mode 0 登记、Mode 1 渲染锁定。

候选模板编译时，共享不变量填入；探索轴写成一至两个有界可见方向，或连同连接词整段省略，不得伪装成已确认事实。

依赖顺序：`文字规格 → Mode 0 → Mode 1 →（Mode 1B 按需）→ Mode 2`；Mode 3、4 按需。已有稳定参考可跳过 Mode 0，但须先确认身份。

### 2. 每个完整 Prompt 都要先确认

完整 Prompt 前确认：

- **已附参考图：** 第一项，逐张列出；没有则写“无，纯文字构建”
- **角色与造型：** 身份关键项及本次要锁定的 Look
- **背景：** 默认 18% 中性灰；候选脸为 neutral mid-gray
- **构图：** 仅在非默认时列出

最后问：**“以上锁定，可以开始写 Prompt 吗？”** 未确认不输出完整 Prompt。

已批准 Prompt 的轻微修改可直接修订；新角色、新 Look 或新模式须重确认。

### 3. Agent 执行协议

每次触发模型前给出路由卡：

- **当前模式与步骤：** 例如 Mode 0／选项 2／第一步试脸
- **模型与参考图：** 精确显示名；逐张职责或“无，纯文字构建”
- **本步产物：** 候选、权威身份卡、服装基准、角色表、细节卡或换装结果

不能绑定或核对模型时停止自动执行，只交付 Prompt，并写“尚未调用模型”。

Mode 0 的选项 2、3 必须分步执行：先用所选模型生成候选，等待用户选定唯一一张，再建立 Lib navo pro 标准身份卡节点。不得同时创建两步或自动替用户选择。候选图不能进入 Mode 1／2；只有用户批准的唯一权威身份卡可以继续。

每次只推进已确认步骤，不预建后续节点；只有出现结果资产才能说“已生成”。

## 参考图职责

- 角色表只保留一个清楚人脸锚点，不得在无头正面格加入第二张脸。
- 只写可见信息，不猜测、用姓名或重复长述；不写真实品牌、受保护 IP 或具体年龄，候选可用 `adult`。
- 除 Mode 4 编号外，只用职责描述，如 `the attached character reference`。

## 通用 Prompt 规则

- 中文交互，英文 Prompt；不写数值画幅，只写 full body、chest-up 等构图。
- 默认中性闭唇；不输出独立 Negative Prompt。
- 每个 Prompt 一个代码块；批量逐项编号。交付前替换或删除全部参数槽。
- 不添加用户未确认的首饰、纹身、妆面或服装细节。

## 角色资产 Flat Grade（Mode 0 正式身份卡、Mode 1 单步、Mode 2）

Mode 0 的正式标准身份卡、Mode 1 单步定妆和 Mode 2 的最终 Prompt 必须原样展开以下英文块：

```text
Background is an even 18% neutral gray seamless, one completely flat uniform value corner to corner, with no seam line, gradient, hotspot, vignette, or falloff. Relight from scratch with completely flat shadowless illumination: one enormous soft frontal source at camera position and matched equal fill from camera-left, camera-right, above, and below, so both sides of the face and body read at identical brightness. No key-to-fill ratio, shadow side, rim light, hair light, kicker, or specular hotspot. Zero shadow cast onto the background, no contact shadow beneath the feet or hem, and no ambient occlusion. Extremely low contrast, even, milky, catalogue-flat. Skin and fabric remain matte and render at their true natural tones, never washed out or cool-shifted by the background. Real fine even pore texture, peach fuzz, subtle subsurface scattering, strand-level hair, real fabric weave and drape, soft natural film grain. Fine, flattering, photographed realism — never plastic, waxy, glass-skin, harsh, or clinically detailed. Photographed on a clean 50mm-equivalent prime with even sharpness. Photographed, not generated.
```

白底例外只把首句替换为 `Pure white seamless studio background, perfectly even, with no gradient or seam line.`，其余条款不变。

方括号是内部参数槽，交付前必须替换或删除。Mode 0 正式身份卡、Mode 1 单步和 Mode 2 拼接 Flat Grade；两条候选脸路线、Mode 1B、Mode 1 两步合成、Mode 3 和 Mode 4 使用各自专属结尾。

---

## Mode 0：定脸与身份锁定

### 进入条件

只用于没有稳定身份参考的新角色。目标是得到后续服装、角色表和特写都能引用的标准身份卡。

正式标准身份卡使用 plain black thin-strap camisole（女性）、plain black ribbed tank（男性）或 plain black crew-neck top（中性人物），采用中性基础修饰，不带 Look 妆面或可选首饰。候选路线统一用黑色圆领上衣。

胸像外的永久标记保留在中文身份账本，待 Mode 1 露出并由 Mode 1B 按需验证；不得声称标准身份卡已视觉锁定画面外细节。

完成中文文字规格的回述与确认后，主动展示三个选项并等待用户选择：

1. **Lib navo pro 标准定脸：** 纯文字直接建立标准身份卡。
2. **Lib Image 网感试脸后锁定：** 探索候选，选一张后由 Lib navo pro 标准化。
3. **Style Image V8.2 高级感试脸后锁定：** 探索候选，选一张后由 Lib navo pro 标准化。

若用户已明确指定，不重复询问。不得把“网感／高级感”当成承诺；它们只是探索方向，最终以实际候选结果和用户选择为准。

确认：

- **路线与模型：** 选项 1 为 Lib navo pro；选项 2 为 Lib Image → Lib navo pro；选项 3 为 Style Image V8.2 → Lib navo pro
- **参考图：** 第一步无参考；候选路线第二步列唯一获选图
- **角色身份：** 骨相、肤色、头发、眼睛与全部已确认身份标记
- **服装与构图：** 正式卡用指定黑色基础上衣；候选用黑色圆领上衣；均为脸占主体的胸像
- **背景：** 正式卡 18% 中性灰；候选 neutral mid-gray

### 标准身份卡英文模板

选项 1 直接使用；选项 2、3 选定候选后使用，并以 `the same character shown in the approved exploratory face reference` 开头。

```text
A clean high-fidelity character identity reference, framed from just above the head to the upper chest with the face dominant in the frame. [IDENTITY: heritage appearance, build, exact natural skin tone and matte finish, face structure, eye shape and exact eye color, hair color, length and texture, and every approved identity marker visible within this crop with precise placement]. [She wears a plain black thin-strap camisole / He wears a plain black ribbed tank / They wear a plain black crew-neck top], with neutral base grooming, no look-specific makeup, and no optional jewelry beyond confirmed identity-defining piercings. Body squared to camera, head level, eyes directly to camera, lips closed, neutral controlled expression.

High face fidelity: soft fine even pores, fine peach fuzz along the jaw and upper lip, subtle subsurface scattering at the cheeks, ear edges, nostrils and eye sockets, individual lash separation, real iris moisture and pattern, natural lip lines, and strand-level hair with baby hairs and flyaways. Keep every feature flattering and natural, with no harsh clinical texture.
```

### Lib Image 网感试脸后锁定

第一步须核对节点为 `Lib Image`。它读取已确认规格，只出非权威候选，不用标准身份卡长模板或 Flat Grade。公众人物／偶像参照先转成用户确认的可见五官、妆发与气质，不写姓名。

```text
Contemporary photorealistic casting portrait of one adult [CONFIRMED HERITAGE APPEARANCE] [woman / man / person] with [CONFIRMED NATURAL SKIN TONE AND UNDERTONE], [CONFIRMED FACE SHAPE AND MODERATE BONE STRUCTURE], [CONFIRMED EYE SHAPE AND COLOR], [CONFIRMED BROWS, NOSE AND LIPS], and [CONFIRMED HAIR COLOR, LENGTH AND TEXTURE]. [LARGE VISIBLE IDENTITY MARKERS ONLY]. [CONFIRMED CONTEMPORARY BEAUTY DIRECTION AS VISIBLE MAKEUP AND GROOMING]. One person only, centered head-and-shoulders framing, face dominant, body square to camera, head level, direct gaze, calm closed-lip expression, plain black crew-neck top. Seamless neutral mid-gray background, soft even frontal studio light, low contrast, natural flattering skin and hair texture, polished contemporary portrait photography.
```

选中唯一候选后切换 Lib navo pro，以获选图为唯一探索参考建立标准卡；批准后才成为权威资产。必要时再用 Lib Image 精修一次，批准结果替代前卡。

### Style Image V8.2 试脸后锁定

第一步必须显式选择并回读 `Style Image V8.2`。模型列表或节点未显示该精确名称时立即停止；不得用其他模型顶替。

本步读取同一份已确认中文规格，但须单独编译短英文 Prompt，不能复用标准身份卡或 Flat Grade。它只负责胸像候选：保留可见脸部、肤色、头发、克制妆面与标记；体型留在中文账本。不得追加微观皮肤、复杂布光或否定清单。

Style Image V8.2 必须通过人像安全编译器。不得复制或自由润色用户原话；先把确认规格规范成封闭字段，每项最多一个可见名词短语：

- 单个明确成年人、性别表达，以及可选的已确认族裔／地域外观；后者不得用于推断其他特征。
- 肤色与底色；脸型、下颌、颧骨；眼形眼色；眉、鼻、唇形与标准颜色。
- 头发颜色、长度、纹理与分缝；当前胸像可见的明显身份标记。
- 妆容仅拆成部位、普通颜色、强度与质地；歧义俗称先规范化。

风格或气质标签、人物比喻、真人／团体／品牌指代、模仿关系、身体评价、年龄暧昧与不可见设定都不是 Prompt 字段。能转成可见属性时先用中文确认，否则整项省略；胸像不写体型。未确认字段连同连接词删除，不得补写。

专属内部编译模板如下。交付结果最多三句、最多 100 个英文词；这是本 Skill 的候选人像安全上限，不是平台官方长度声明：

```text
Studio portrait of one adult [CONFIRMED SUBJECT TERM] with [CONFIRMED SKIN TONE, FACE, EYES, BROWS, NOSE, LIPS AND HAIR]. [OPTIONAL CONFIRMED VISIBLE IDENTITY MARKER AND MAKEUP EXPRESSED ONLY AS AREA, STANDARD COLOR, INTENSITY AND FINISH]. Centered head-and-shoulders framing, direct gaze, calm closed-lip expression, plain black crew-neck top, seamless neutral mid-gray background, soft even frontal studio light, low contrast, natural skin and hair texture, 85mm portrait photography.
```

提交或创建节点前执行失败关闭检查，任一项不通过都不得输出 Prompt、创建节点或调用模型：

1. 仅一名明确成年人；全部可变描述可追溯到确认字段，且只写胸像可见信息。
2. 无真人、团体、品牌、受保护形象、模仿关系、风格标签、人物比喻、年龄暧昧或身体评价。
3. 妆容符合封闭字段；最终文本只写期望画面，不含否定清单、模型／平台名、参数、中文、冒号式长清单或未替换槽位。
4. 最多三句、100 个英文词；固定保留单人胸像、黑色圆领上衣、中灰背景、柔和均匀正面光与低对比度。

失败时从封闭字段重编一次；仍不合格则停止并说明“V8.2 人像 Prompt 未通过提交前检查”。通过后内部记录 `V8.2 portrait lint: PASS`，不写入 Prompt。画幅与 Raw 只通过界面控件设置。

创建节点后回读实际模型名、Prompt、画幅与 Raw。Prompt 必须与检查通过版逐字一致；若被再次翻译、润色或删改，立即停止，不得生成。

错误必须按界面证据分流，不得混为一类，也不得连续自动重试：

- 明确出现 `AI Moderator`、`unsure about this prompt` 或同义审核提示：记为“审核不确定性拦截”，不能声称用户违规。用上方模板仅保留成年人、核心脸部字段、头发与固定构图环境；通过提交前检查后，只交付一次修订版供用户确认，不得自动重试。
- 只出现 `Failed to submit`、`Creation failed unexpectedly` 等通用提交错误：不能先改 Prompt，也不能推断是审核。先核对实际节点仍显示 `Style Image V8.2`、平台提交状态，以及在能够访问权威状态来源时核对服务状态；无法核实时明确写“原因无法确认”。用户确认后最多原样重试一次。
- 权威状态来源明确显示服务异常：停止并报告，不改 Prompt、不重试、不切模型。
- 任一分支在一次经用户确认的重试后仍失败：停止并回报界面原始错误、实际模型节点名称和已执行的检查；不得静默切换模型。

用户选中唯一探索结果后，第二步必须显式切换到 Lib navo pro，并把获选图作为唯一探索参考。回到标准身份卡模板，补齐精确眼色、脸型和当前裁切可见标记，并回归中性基础修饰。第二步经批准后才成为唯一权威身份卡，其他候选不得继续引用。

如果第二步完成后，眼色、穿孔、美人痣、细小疤痕、唇纹或发际线仍未达到用户要求，可询问是否使用 Lib Image 进行一次按需精修。精修必须以上一步标准身份卡为唯一身份参考，不得重新发明人物；用户批准精修结果后，它替代上一步成为唯一权威身份卡。

---

## Mode 1：服装定妆

### 进入条件

必须已有用户确认的角色身份参考。每套新服装先获得一张用户满意的单人定妆图，之后才能制作 Mode 2。

先锁定完整 Look：服装、鞋、首饰、配件、妆面、发型／发饰、美甲和可见永久标记。身份卡登记永久标记的位置，Mode 1 决定是否可见；标志性常戴配饰须与身份登记一致。

- **Lib navo pro 单步定妆：** 默认路线，直接用角色参考和文字规格完成。
- **Lib navo pro 两步合成：** 仅限复杂服装且界面支持双参考；先做普通模特 Look，再替换为锁定角色。

确认：

- **模型：** Lib navo pro
- **角色参考与路线：** 已批准身份卡；单步或两步
- **完整 Look：** 服装、鞋、首饰、配件、妆面、发型／发饰、美甲、可见永久标记
- **姿势与构图：** 默认全身，手与鞋完整可见
- **背景：** 18% 中性灰无缝背景

### 单步定妆

默认全身、轻微转角、中性表情，手鞋完整可见。

```text
The same character shown in the attached identity reference. Preserve the face, bone structure, body proportions, natural skin tone, base hair identity and every approved permanent identity marker. The character wears [COMPLETE APPROVED WARDROBE FROM HEAD TO TOE: garments, fabric, color, fit, construction, layering, footwear, jewelry and accessories]. Apply [APPROVED MAKEUP, HAIRSTYLE OR HAIR ACCESSORIES, AND NAIL LENGTH, SHAPE, COLOR OR ART]. Keep every approved permanent marker visible at its exact placement wherever the outfit exposes it. [POSE: body angle, weight distribution, hand position, gaze and neutral controlled expression]. [FULL-BODY / WAIST-UP / HEAD-TO-SHOULDERS FRAMING].
```

把角色资产 Flat Grade 原样拼接在该模板末尾。

### 两步合成

仅在双参考可用时提供。第一步用 Lib navo pro 制作普通修长模特 Look；头发须与获批发型兼容，人物正面中性站立。

```text
A slim [woman / man] stands straight-on to camera in a relaxed neutral stance, weight even across both feet, arms relaxed at the sides, shoulders level, eyes to camera, lips closed. [SIMPLE NEUTRAL HAIR COMPATIBLE WITH THE APPROVED STYLING], clean even features, neutral natural skin tone. The figure wears [COMPLETE APPROVED OUTFIT, FOOTWEAR, JEWELRY AND ACCESSORIES] with [APPROVED MAKEUP, COMPATIBLE HAIR STYLING, HAIR ACCESSORIES AND NAILS]. Full-body framing with all footwear visible. Background is an even 18% neutral gray seamless with no seam line, gradient, hotspot, or vignette. Soft broad frontal studio illumination keeps the complete look clean, matte, evenly readable, and true in color. No dramatic shadow, rim light, or background cast shadow. Real fabric weave, weight and drape; natural skin texture; soft film grain. Photographed, not generated.
```

第二步继续用 Lib navo pro，参考顺序与 Mode 4 相同：

- **reference image 1：** 第一步生成的普通模特服装图，提供完整 Look 与姿势。
- **reference image 2：** 锁定角色身份参考，提供脸、骨相、比例、肤色、基础头发身份和永久标记。

```text
Replace the person in reference image 1 with the person from reference image 2. Keep the complete outfit, footwear, jewelry, accessories, makeup, hair accessories, nails and pose from reference image 1 exactly. Recreate the approved compatible hair arrangement while preserving the hair color, length, texture, density and hairline from reference image 2. Match the face, bone structure, body proportions, natural skin tone and permanent identity markers from reference image 2. Clean neutral mid-gray seamless studio background, soft large-source studio lighting, true natural colors, natural film grain, full-body framing.
```

第二步不重写长描述、不追加 Flat Grade；两张参考图承担信息。

---

## Mode 1B：造型细节卡（可选）

使用 Lib Image，以批准的 Mode 1 服装基准图为主参考；支持双参考时再附权威身份卡。仅在全身图看不清或用户要求时进入。每张只放大一个区域：美甲／戒指／手链、纹身、耳饰、项链、鞋或服装工艺；多区域分开生成。脸为主体用 Mode 3，饰品或身体部位为主体用 Mode 1B。

若细节在 Mode 1 中错误或缺失，先回 Mode 1 修正并重新批准；Mode 1B 只放大已批准但尺寸太小的细节。

```text
A high-fidelity styling detail reference of the same character and look shown in the approved outfit reference. [IF ATTACHED: the approved identity reference controls body proportions, natural skin tone, base hair identity and permanent markers only.] Tight close-up of [ONE APPROVED BODY OR WARDROBE AREA]. Preserve the exact natural skin tone, anatomy, garment context and every permanent marker visible in this crop. Show [APPROVED NAILS, JEWELRY, TATTOO, PIERCING, FOOTWEAR OR GARMENT-CONSTRUCTION DETAIL] with its exact color, material, pattern, scale and placement. Neutral mid-gray seamless studio background, soft even frontal light, low contrast, true colors, realistic skin and material texture. Include only the approved design with no extra symbols, accessories or decoration.
```

细节卡仅作辅助，不替代身份卡或服装基准图。

---

## Mode 2：三格角色表

### 进入条件与布局

使用 Lib navo pro，必须已有批准的 Mode 1 单张定妆图。左格去掉低分辨率小脸，右格是唯一高分辨率人脸锚点；不得把头加回左格。

固定一张横图、三个等宽竖格：

1. 左：无头正面全身，保留正常头顶留白，不是裁掉头。
2. 中：带头背面全身，后发、服装背部、下摆和鞋完整。
3. 右：头顶上方至锁骨的紧胸像，不得放宽为腰上。

### Mode 2 专属确认

确认：

- **模型：** Lib navo pro
- **参考图：** 批准的服装基准图与所需身份参考
- **三格：** 左格领口变体、中格背面全身、右格紧胸像
- **Look：** 三格完全一致
- **背景：** 三格统一的 18% 中性灰无缝背景
- **画幅比例：** 16:9 横屏

创建或调用 Mode 2 图像节点时，必须显式设置为 16:9；创建后回读节点显示比例，若不是 16:9，停止生成并先修正比例。

### 左格无头变体

- 闭合或有结构领口用 ghost mannequin hollow；抹胸、挂脖、细肩带、深挖领用 clean neck cut。

```text
LEFT PANEL — full-body front view, no head, no neck, and no hair. The body stands squared to camera from the shoulders down to [THE SHOES / THE HEM], arms relaxed at the sides, hands open and loose, weight even across both feet. Nothing rises above the shoulder line, and no hair falls across the chest or shoulders. The [COLLAR TYPE] of the [GARMENT] holds its own shape and opens into an empty dark hollow looking down into the inside of the garment, with the inner back fabric faintly visible. The outfit keeps full three-dimensional shape, natural drape, and real fabric tension as if worn by an invisible body, but nothing emerges from the neckline. [IF A NECKLACE IS APPROVED: the necklace remains arranged around the empty collar opening and rests naturally on the garment.] No stump, skin, cut edge, anatomy, blood, gore, blur, fade, smoke, ghosting, or transparency in the body. Preserve generous empty headroom above the shoulders so the figure sits at the same scale and position as a normal full-body portrait; the head is removed from the body, not cropped by the frame. Keep the complete footwear or hem fully visible.
```

```text
LEFT PANEL — full-body front view, headless. The full figure stands squared to camera from the shoulders down to [THE SHOES / THE HEM], arms relaxed at the sides, hands open and loose, weight even across both feet. There is no head and no hair; no hair falls across the chest or shoulders. The neck rises a short way from the shoulders and terminates in a clean, flat, sharply defined horizontal edge at the base of the throat, exactly like a headless dress-form mannequin. Above that crisp sculptural edge there is only empty gray background. No blood, gore, anatomy detail, stump, blur, fade, smoke, ghosting, or transparency. Preserve generous empty headroom above the shoulders so the figure sits at the same scale and position as a normal full-body portrait; the head is removed from the body, not cropped by the frame. Keep the complete footwear or hem fully visible.
```

### 三格总模板

```text
A three-panel character reference sheet in one horizontal frame, divided into three equal vertical panels with thin clean separation. The same figure and the same outfit remain identical across all three panels.

[IDENTITY ONCE: build, exact natural skin tone, hair, makeup, identity markers and nails]. [WARDROBE ONCE: complete outfit, materials, construction, footwear, jewelry and accessories].

[INSERT THE CORRECT LEFT-PANEL BLOCK, FILLED WITH GARMENT DETAILS].

CENTER PANEL — full-body rear view, head attached, standing straight with arms relaxed. Show the complete hair fall, garment back construction, hem and footwear.

RIGHT PANEL — tight chest-up identity portrait from just above the head to the collarbones and the very top of the garment. The face fills most of the panel; body squared to camera, eyes to camera, lips closed, neutral controlled expression.

Apply the authority flat grade identically across all three panels. Keep the same gray value, shadowless light and zero cast shadow in every panel. Skin remains identical in value and hue across face, back, arms and hands; garment colors, body proportions and identity remain identical in every panel.
```

展开 Flat Grade 到三格；只输出一个 Prompt 和一个结果。

## Mode 3：高精度面部特写

使用 Lib Image，仅在用户要求脸部、肩上或胸像细节时进入。它不重建身份；权威身份卡回 Mode 0，非脸部细节用 Mode 1B。构图可选 chest-up、shoulders-up、forehead-to-collarbone。

确认：

- **模型：** Lib Image
- **身份参考：** 已批准的角色身份图
- **裁切：** chest-up、shoulders-up 或 forehead-to-collarbone
- **细节：** 眼色、妆面、唇部、耳饰、服装上缘、身份标记、视线和微表情
- **背景与灯光：** 中性灰背景、克制柔和人像光

```text
A high-fidelity [CHEST-UP / SHOULDERS-UP / FOREHEAD-TO-COLLARBONE] identity-reference portrait of the same character shown in the attached identity reference. Preserve the face, bone structure, exact natural skin tone, hair and every approved identity marker visible within this crop. [VISIBLE HAIR, MAKEUP, EYE COLOR, LIP DETAIL, EAR AND COLLAR JEWELRY, AND WARDROBE WITHIN THE CROP]. [HEAD ANGLE, GAZE AND NEUTRAL MICRO-EXPRESSION].

Neutral mid-gray seamless studio background with no visible seam or distracting gradient. A broad diffused source from camera-left and slightly above gives a gentle natural wrap across the face, balanced by soft frontal fill so the off-light side remains open and readable. No harsh shadow, dramatic contrast, hard rim, kicker, or glossy beauty glare. Skin stays matte and true to its natural tone.

Extreme face fidelity: soft fine even pores, peach fuzz, subtle subsurface scattering, individual lashes, real iris moisture and pattern, natural lip lines, strand-level hair with baby hairs and flyaways, and visible collar fabric weave. Keep the result flattering and natural, never harsh or clinically detailed.

Soft natural film grain, gentle highlight roll-off, photographed on a clean portrait prime. Photographed, not generated.
```

Mode 3 不追加角色资产 Flat Grade；上面的背景、灯光和细节段就是完整专属结尾。

---

## Mode 4：两参考图换装

使用 Lib navo pro。只有当前界面确认可以同时附加两张参考图时才进入；若只能附加一张图，明确说明能力不足，不假装完成身份与服装的双重锁定。

### 固定参考图语义

- **reference image 1：** 服装、配饰、美甲与姿势来源。
- **reference image 2：** 人物身份来源，保留脸、骨相、体型、身体比例、肤色、基础头发身份和永久标记。

顺序不可颠倒。确认模型、逐张职责与默认完整全身灰底输出；Prompt 只用自然语言编号。

```text
Replace the character in reference image 1 with the character in reference image 2. Keep the outfit, footwear, jewelry, accessories, nails and pose from reference image 1 exactly. Match the face, bone structure, body type, body proportions, skin tone, base hair identity and permanent identity markers from reference image 2. Clean mid-gray seamless studio background, even neutral mid-gray with no seam line, soft large-source studio lighting, true natural skin and outfit colors, natural film grain, full-body framing.
```

Mode 4 只换装；不重写长描述或追加 Flat Grade，两张参考图承担信息。

## 交付前检查

- 依赖与节点显示名正确；候选先选唯一图，再由 Lib navo pro 建标准卡。
- Style Image V8.2 Prompt 已通过人像安全编译器：字段可追溯、最多三句与 100 个英文词、无开放审美措辞或未填槽位；创建节点后实际 Prompt 与批准文本逐字一致。
- Mode 1 锁定完整 Look；Mode 1B 一卡一区；参考图已确认。
- Mode 2 只输出三格；左格领口变体、手脚、重心、头顶留白正确，右格是唯一正脸锚点。
- Flat Grade 仅用于正式卡、Mode 1 单步和 Mode 2；Mode 3 只做脸，Mode 4 图 1 管造型姿势、图 2 管身份。
- 最终 Prompt 无模型／平台名、姓名、品牌、具体年龄、画幅数字或未填参数；候选可用 `adult`。
- 用户已通过确认门。

## 最终交付格式

用户确认后，只输出完全编译、必需英文块已展开的英文代码块；批量时逐项编号。