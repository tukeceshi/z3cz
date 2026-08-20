UPDATE "platform_settings"
SET "competitor_video_pricing" = jsonb_set(
  "competitor_video_pricing"::jsonb,
  '{scenarios}',
  $json$[{"id":"clip","name":"制作一条视频","description":"常规（ 2.0，15秒，720P）做计价参考？别轻信平台定价，视频参考计费、其他模型、分辨率的价格你看不到？在下方调整参数，或上方切换预设场景。来试试适合你的方式吧。","sortOrder":0,"params":{"canonicalId":"doubao-seedance-2","ratio":"16:9","resolution":"720p","durationSec":15,"gachaCount":1,"referencedClipCount":0,"avgReferenceSec":0}},{"id":"learn","name":"学习制作","description":"跟着教程实操：5分钟视频，抽两次卡成10分钟，引用视频参考也就玩几下。模型和分辨率不用太高，够用就行。可您猜怎么着？最低级会员居然就撑不住了。如果您只是练手，不妨看看下方折扣信息，里面有免费额度可以白嫖。","sortOrder":1,"params":{"canonicalId":"doubao-seedance-2-mini","ratio":"16:9","resolution":"480p","durationSec":600,"gachaCount":2,"referencedClipCount":5,"avgReferenceSec":5}},{"id":"personal","name":"个人创作","description":"重生之AI风口，目标抖音百万大咖，周更精品，月产15分钟正片。3次抽卡硬核打磨，实际成本45分钟。已是各大平台最高级会员，全职投入不必计较支出。季度付费可省钱，但更推荐按量使用火山引擎。","sortOrder":2,"params":{"canonicalId":"doubao-seedance-2","ratio":"16:9","resolution":"720p","durationSec":2700,"gachaCount":2,"referencedClipCount":30,"avgReferenceSec":10}},{"id":"pipeline","name":"流水线短剧","description":"逆风局，自己定规则。480p配2.0，低成本出奇迹；抽卡是玄学，穿帮是玄机。一天两分钟，一月三十集，平台敢要我就敢给。今天你说我土，年底我开路虎接你。","sortOrder":3,"params":{"canonicalId":"doubao-seedance-2","ratio":"9:16","resolution":"480p","durationSec":3600,"gachaCount":1,"referencedClipCount":0,"avgReferenceSec":0}},{"id":"restyle","name":"转绘","description":"别扯玄学，1:1转绘的灵魂就是100%参考原视频。可平台算法乱得很，不同模型或分辨率积分算法不统一，所以你得在下方参数栏微调，看实际情况为准。","sortOrder":4,"params":{"canonicalId":"doubao-seedance-2","ratio":"9:16","resolution":"720p","durationSec":3600,"gachaCount":1,"referencedClipCount":240,"avgReferenceSec":15}},{"id":"premium4k","name":"4K精品","description":"大佬，先跪为敬。4K精品，画质屠榜；20分钟成片，半年雕琢，抖音一上，天下皆知。背后是3次抽卡试错，25%素材参考，成本直逼二手车轮。这分量，我只推年付会员。不过提醒一句：下方表格季度年度价差不太直观，还得劳烦大佬亲自心算一笔。","sortOrder":5,"params":{"canonicalId":"doubao-seedance-2","ratio":"16:9","resolution":"4k","durationSec":3600,"gachaCount":2,"referencedClipCount":60,"avgReferenceSec":10}},{"id":"drama25","name":"2.5短剧","description":"2.5版本是接入官方渠道的最佳起点，尤其针对1080p，官方目前正推出折扣活动。制作层面，30秒足以完成一次流畅的镜头切换，全片一致性表现出色，足以支撑30分钟成品。成本方面，抽卡仅按0.5计，视频参考仅需10%。这套组合，无疑是精品短剧的最优解。","sortOrder":6,"params":{"canonicalId":"doubao-seedance-2-5","ratio":"9:16","resolution":"1080p","durationSec":2700,"gachaCount":2,"referencedClipCount":9,"avgReferenceSec":5}}]$json$::jsonb,
  true
)::text
WHERE "competitor_video_pricing" IS NOT NULL
  AND btrim("competitor_video_pricing") <> ''
  AND (
    ("competitor_video_pricing"::jsonb->'scenarios') IS NULL
    OR jsonb_typeof("competitor_video_pricing"::jsonb->'scenarios') <> 'array'
    OR jsonb_array_length("competitor_video_pricing"::jsonb->'scenarios') = 0
  );
