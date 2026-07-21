import { BaseNodeRegistry } from "@dafthunk/runtime";
import {
  FailingMultiStepNode,
  MultiStepAdditionNode,
} from "@dafthunk/runtime/specification/test-nodes";
import { CgsApplyMaterialNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-apply-material-node";
import { CgsApplyTextureNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-apply-texture-node";
import { CgsConeNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-cone-node";
import { CgsCubeNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-cube-node";
import { CgsCylinderNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-cylinder-node";
import { CgsDifferenceNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-difference-node";
import { CgsIntersectionNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-intersection-node";
import { CgsRotateNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-rotate-node";
import { CgsScaleNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-scale-node";
import { CgsSphereNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-sphere-node";
import { CgsTorusNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-torus-node";
import { CgsTranslateNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-translate-node";
import { CgsUnionNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-union-node";
import { CgsXorNode } from "@dafthunk/runtime-legacy/nodes/3d/cgs-xor-node";
import { DemToGltfNode } from "@dafthunk/runtime-legacy/nodes/3d/dem-to-gltf-node";
import { GeoTiffDemQueryNode } from "@dafthunk/runtime-legacy/nodes/3d/geotiff-dem-query-node";
import { GeoTiffMetadataReaderNode } from "@dafthunk/runtime-legacy/nodes/3d/geotiff-metadata-reader-node";
import { GeoTiffQueryNode } from "@dafthunk/runtime-legacy/nodes/3d/geotiff-query-node";
import { GeoTiffTransformNode } from "@dafthunk/runtime-legacy/nodes/3d/geotiff-transform-node";
import { GltfWireframeNode } from "@dafthunk/runtime-legacy/nodes/3d/gltf-wireframe-node";
import { AgentClaudeSonnet4Node } from "@dafthunk/runtime-legacy/nodes/agent/agent-claude-sonnet-4-node";
import { AgentGemini25FlashNode } from "@dafthunk/runtime-legacy/nodes/agent/agent-gemini-2-5-flash-node";
import { AgentGemini31ProNode } from "@dafthunk/runtime-legacy/nodes/agent/agent-gemini-3-1-pro-node";
import { AgentGemini3FlashNode } from "@dafthunk/runtime-legacy/nodes/agent/agent-gemini-3-flash-node";
import { AgentGpt41Node } from "@dafthunk/runtime-legacy/nodes/agent/agent-gpt-41-node";
import { AgentQwen330BA3BFp8Node } from "@dafthunk/runtime-legacy/nodes/agent/agent-qwen3-30b-a3b-fp8-node";
import { Claude3OpusNode } from "@dafthunk/runtime-legacy/nodes/anthropic/claude-3-opus-node";
import { Claude35HaikuNode } from "@dafthunk/runtime-legacy/nodes/anthropic/claude-35-haiku-node";
import { Claude35SonnetNode } from "@dafthunk/runtime-legacy/nodes/anthropic/claude-35-sonnet-node";
import { Claude37SonnetNode } from "@dafthunk/runtime-legacy/nodes/anthropic/claude-37-sonnet-node";
import { ClaudeOpus4Node } from "@dafthunk/runtime-legacy/nodes/anthropic/claude-opus-4-node";
import { ClaudeOpus41Node } from "@dafthunk/runtime-legacy/nodes/anthropic/claude-opus-41-node";
import { ClaudeSonnet4Node } from "@dafthunk/runtime-legacy/nodes/anthropic/claude-sonnet-4-node";
import { AggregateItemsNode } from "@dafthunk/runtime-legacy/nodes/array/aggregate-items-node";
import { ExtractItemNode } from "@dafthunk/runtime-legacy/nodes/array/extract-item-node";
import { BlobToFormDataNode } from "@dafthunk/runtime-legacy/nodes/blob/blob-to-form-data-node";
import { BlobToJsonNode } from "@dafthunk/runtime-legacy/nodes/blob/blob-to-json-node";
import { BlobToTextNode } from "@dafthunk/runtime-legacy/nodes/blob/blob-to-text-node";
import { FileNode } from "@dafthunk/runtime-legacy/nodes/blob/file-node";
import { JsonToBlobNode } from "@dafthunk/runtime-legacy/nodes/blob/json-to-blob-node";
import { TextToBlobNode } from "@dafthunk/runtime-legacy/nodes/blob/text-to-blob-node";
import { CloudflareBrowserContentNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-content-node";
import { CloudflareBrowserCrawlNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-crawl-node";
import { CloudflareBrowserCrawlQueueNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-crawl-queue-node";
import { CloudflareBrowserJsonNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-json-node";
import { CloudflareBrowserLinksNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-links-node";
import { CloudflareBrowserMarkdownNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-markdown-node";
import { CloudflareBrowserPdfNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-pdf-node";
import { CloudflareBrowserScrapeNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-scrape-node";
import { CloudflareBrowserScreenshotNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-screenshot-node";
import { CloudflareBrowserSnapshotNode } from "@dafthunk/runtime-legacy/nodes/browser/cloudflare-browser-snapshot-node";
import { CloudflareGatewayModelNode } from "@dafthunk/runtime-legacy/nodes/cloudflare/cloudflare-gateway-model-node";
import { CloudflareModelNode } from "@dafthunk/runtime-legacy/nodes/cloudflare/cloudflare-model-node";
import { AiInterfaceNode } from "@dafthunk/runtime-legacy/nodes/ai-interface/ai-interface-node";
import { CsvExtractColumnNode } from "@dafthunk/runtime-legacy/nodes/csv/csv-extract-column-node";
import { CsvFilterRowsNode } from "@dafthunk/runtime-legacy/nodes/csv/csv-filter-rows-node";
import { CsvParseNode } from "@dafthunk/runtime-legacy/nodes/csv/csv-parse-node";
import { CsvStringifyNode } from "@dafthunk/runtime-legacy/nodes/csv/csv-stringify-node";
import { DatabaseCreateTableNode } from "@dafthunk/runtime-legacy/nodes/database/database-create-table-node";
import { DatabaseDeleteRowNode } from "@dafthunk/runtime-legacy/nodes/database/database-delete-row-node";
import { DatabaseDescribeTableNode } from "@dafthunk/runtime-legacy/nodes/database/database-describe-table-node";
import { DatabaseDropTableNode } from "@dafthunk/runtime-legacy/nodes/database/database-drop-table-node";
import { DatabaseExecuteNode } from "@dafthunk/runtime-legacy/nodes/database/database-execute-node";
import { DatabaseExportTableNode } from "@dafthunk/runtime-legacy/nodes/database/database-export-table-node";
import { DatabaseGetRowCountNode } from "@dafthunk/runtime-legacy/nodes/database/database-get-row-count-node";
import { DatabaseGetRowNode } from "@dafthunk/runtime-legacy/nodes/database/database-get-row-node";
import { DatabaseImportTableNode } from "@dafthunk/runtime-legacy/nodes/database/database-import-table-node";
import { DatabaseListTablesNode } from "@dafthunk/runtime-legacy/nodes/database/database-list-tables-node";
import { DatabasePutRowNode } from "@dafthunk/runtime-legacy/nodes/database/database-put-row-node";
import { DatabaseQueryNode } from "@dafthunk/runtime-legacy/nodes/database/database-query-node";
import { DatabaseRowExistsNode } from "@dafthunk/runtime-legacy/nodes/database/database-row-exists-node";
import { DatabaseTableExistsNode } from "@dafthunk/runtime-legacy/nodes/database/database-table-exists-node";
import { DatabaseTruncateTableNode } from "@dafthunk/runtime-legacy/nodes/database/database-truncate-table-node";
import { ParquetQueryNode } from "@dafthunk/runtime-legacy/nodes/database/parquet-query-node";
import { DatasetAiSearchNode } from "@dafthunk/runtime-legacy/nodes/dataset/dataset-ai-search-node";
import { DatasetDeleteFileNode } from "@dafthunk/runtime-legacy/nodes/dataset/dataset-delete-file-node";
import { DatasetDownloadFileNode } from "@dafthunk/runtime-legacy/nodes/dataset/dataset-download-file-node";
import { DatasetListFilesNode } from "@dafthunk/runtime-legacy/nodes/dataset/dataset-list-files-node";
import { DatasetSearchNode } from "@dafthunk/runtime-legacy/nodes/dataset/dataset-search-node";
import { DatasetUploadFileNode } from "@dafthunk/runtime-legacy/nodes/dataset/dataset-upload-file-node";
import { AddDateNode } from "@dafthunk/runtime-legacy/nodes/date/add-date-node";
import { DiffDateNode } from "@dafthunk/runtime-legacy/nodes/date/diff-date-node";
import { NowDateNode } from "@dafthunk/runtime-legacy/nodes/date/now-date-node";
import { ParseDateNode } from "@dafthunk/runtime-legacy/nodes/date/parse-date-node";
import { AddReactionDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/add-reaction-discord-node";
import { BotAddReactionDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/bot-add-reaction-discord-node";
import { BotReceiveDiscordMessageNode } from "@dafthunk/runtime-legacy/nodes/discord/bot-receive-discord-message-node";
import { BotSendDMDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/bot-send-dm-discord-node";
import { BotSendMessageDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/bot-send-message-discord-node";
import { GetChannelDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/get-channel-discord-node";
import { GetGuildDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/get-guild-discord-node";
import { ListGuildChannelsDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/list-guild-channels-discord-node";
import { ListUserGuildsDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/list-user-guilds-discord-node";
import { SendDMDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/send-dm-discord-node";
import { SendMessageDiscordNode } from "@dafthunk/runtime-legacy/nodes/discord/send-message-discord-node";
import { ToMarkdownNode } from "@dafthunk/runtime-legacy/nodes/document/to-markdown-node";
import { EmailAgentClaudeSonnet4Node } from "@dafthunk/runtime-legacy/nodes/email/email-agent-claude-sonnet-4-node";
import { ExtractEmailAttachmentsNode } from "@dafthunk/runtime-legacy/nodes/email/extract-email-attachments-node";
import { GetEmailThreadNode } from "@dafthunk/runtime-legacy/nodes/email/get-email-thread-node";
import { ParseEmailNode } from "@dafthunk/runtime-legacy/nodes/email/parse-email-node";
import { ReceiveEmailNode } from "@dafthunk/runtime-legacy/nodes/email/receive-email-node";
import { SendEmailNode } from "@dafthunk/runtime-legacy/nodes/email/send-email-node";
import { FetchNode } from "@dafthunk/runtime-legacy/nodes/fetch/fetch-node";
import { FormRequestNode } from "@dafthunk/runtime-legacy/nodes/form/form-request-node";
// import { TrashMessageGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/trash-message-google-mail-node";
// import { UpdateDraftGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/update-draft-google-mail-node";
import { FormResponseNode } from "@dafthunk/runtime-legacy/nodes/form/form-response-node";
import { FormWebhookNode } from "@dafthunk/runtime-legacy/nodes/form/form-webhook-node";
import { Gemini25FlashAudioUnderstandingNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-flash-audio-understanding-node";
import { Gemini25FlashImagePreviewNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-flash-image-preview-node";
import { Gemini25FlashImageUnderstandingNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-flash-image-understanding-node";
import { Gemini25FlashNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-flash-node";
import { Gemini25FlashTtsNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-flash-tts-node";
import { Gemini25ProAudioUnderstandingNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-pro-audio-understanding-node";
import { Gemini25ProImageUnderstandingNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-pro-image-understanding-node";
import { Gemini25ProNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-2-5-pro-node";
import { Gemini31FlashImagePreviewNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-3-1-flash-image-preview-node";
import { Gemini31ProNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-3-1-pro-node";
import { Gemini3FlashNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-3-flash-node";
import { Gemini3ProImagePreviewNode } from "@dafthunk/runtime-legacy/nodes/gemini/gemini-3-pro-image-preview-node";
import { ImagenNode } from "@dafthunk/runtime-legacy/nodes/gemini/imagen-node";
import { AlongNode } from "@dafthunk/runtime-legacy/nodes/geo/along-node";
import { AngleNode } from "@dafthunk/runtime-legacy/nodes/geo/angle-node";
import { AreaNode } from "@dafthunk/runtime-legacy/nodes/geo/area-node";
import { BboxClipNode } from "@dafthunk/runtime-legacy/nodes/geo/bbox-clip-node";
import { BboxNode } from "@dafthunk/runtime-legacy/nodes/geo/bbox-node";
import { BboxPolygonNode } from "@dafthunk/runtime-legacy/nodes/geo/bbox-polygon-node";
import { BearingNode } from "@dafthunk/runtime-legacy/nodes/geo/bearing-node";
import { BooleanClockwiseNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-clockwise-node";
import { BooleanConcaveNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-concave-node";
import { BooleanContainsNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-contains-node";
import { BooleanCrossesNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-crosses-node";
import { BooleanDisjointNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-disjoint-node";
import { BooleanEqualNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-equal-node";
import { BooleanIntersectsNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-intersects-node";
import { BooleanOverlapNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-overlap-node";
import { BooleanParallelNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-parallel-node";
import { BooleanPointInPolygonNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-point-in-polygon-node";
import { BooleanPointOnLineNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-point-on-line-node";
import { BooleanTouchesNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-touches-node";
import { BooleanValidNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-valid-node";
import { BooleanWithinNode } from "@dafthunk/runtime-legacy/nodes/geo/boolean-within-node";
import { BufferNode } from "@dafthunk/runtime-legacy/nodes/geo/buffer-node";
import { CenterMeanNode } from "@dafthunk/runtime-legacy/nodes/geo/center-mean-node";
import { CenterMedianNode } from "@dafthunk/runtime-legacy/nodes/geo/center-median-node";
import { CenterNode } from "@dafthunk/runtime-legacy/nodes/geo/center-node";
import { CenterOfMassNode } from "@dafthunk/runtime-legacy/nodes/geo/center-of-mass-node";
import { CentroidNode } from "@dafthunk/runtime-legacy/nodes/geo/centroid-node";
import { CircleNode } from "@dafthunk/runtime-legacy/nodes/geo/circle-node";
import { CleanCoordsNode } from "@dafthunk/runtime-legacy/nodes/geo/clean-coords-node";
import { CombineNode } from "@dafthunk/runtime-legacy/nodes/geo/combine-node";
import { ConcaveNode } from "@dafthunk/runtime-legacy/nodes/geo/concave-node";
import { ConvexNode } from "@dafthunk/runtime-legacy/nodes/geo/convex-node";
import { DestinationNode } from "@dafthunk/runtime-legacy/nodes/geo/destination-node";
import { DifferenceNode } from "@dafthunk/runtime-legacy/nodes/geo/difference-node";
import { DistanceNode } from "@dafthunk/runtime-legacy/nodes/geo/distance-node";
import { EnvelopeNode } from "@dafthunk/runtime-legacy/nodes/geo/envelope-node";
import { ExplodeNode } from "@dafthunk/runtime-legacy/nodes/geo/explode-node";
import { FeatureCollectionNode } from "@dafthunk/runtime-legacy/nodes/geo/feature-collection-node";
import { FeatureNode } from "@dafthunk/runtime-legacy/nodes/geo/feature-node";
import { FlattenNode } from "@dafthunk/runtime-legacy/nodes/geo/flatten-node";
import { FlipNode } from "@dafthunk/runtime-legacy/nodes/geo/flip-node";
import { GeoJsonNode } from "@dafthunk/runtime-legacy/nodes/geo/geojson-node";
import { GeoJsonToSvgNode } from "@dafthunk/runtime-legacy/nodes/geo/geojson-to-svg-node";
import { GeometryCollectionNode } from "@dafthunk/runtime-legacy/nodes/geo/geometry-collection-node";
import { GreatCircleNode } from "@dafthunk/runtime-legacy/nodes/geo/great-circle-node";
import { IntersectNode } from "@dafthunk/runtime-legacy/nodes/geo/intersect-node";
import { KinksNode } from "@dafthunk/runtime-legacy/nodes/geo/kinks-node";
import { LengthNode } from "@dafthunk/runtime-legacy/nodes/geo/length-node";
import { LineArcNode } from "@dafthunk/runtime-legacy/nodes/geo/line-arc-node";
import { LineChunkNode } from "@dafthunk/runtime-legacy/nodes/geo/line-chunk-node";
import { LineIntersectNode } from "@dafthunk/runtime-legacy/nodes/geo/line-intersect-node";
import { LineOffsetNode } from "@dafthunk/runtime-legacy/nodes/geo/line-offset-node";
import { LineOverlapNode } from "@dafthunk/runtime-legacy/nodes/geo/line-overlap-node";
import { LineSegmentNode } from "@dafthunk/runtime-legacy/nodes/geo/line-segment-node";
import { LineSliceAlongNode } from "@dafthunk/runtime-legacy/nodes/geo/line-slice-along-node";
import { LineSliceNode } from "@dafthunk/runtime-legacy/nodes/geo/line-slice-node";
import { LineSplitNode } from "@dafthunk/runtime-legacy/nodes/geo/line-split-node";
import { LineToPolygonNode } from "@dafthunk/runtime-legacy/nodes/geo/line-to-polygon-node";
import { LineStringNode } from "@dafthunk/runtime-legacy/nodes/geo/linestring-node";
import { MaskNode } from "@dafthunk/runtime-legacy/nodes/geo/mask-node";
import { MidpointNode } from "@dafthunk/runtime-legacy/nodes/geo/midpoint-node";
import { MultiLineStringNode } from "@dafthunk/runtime-legacy/nodes/geo/multilinestring-node";
import { MultiPointNode } from "@dafthunk/runtime-legacy/nodes/geo/multipoint-node";
import { MultiPolygonNode } from "@dafthunk/runtime-legacy/nodes/geo/multipolygon-node";
import { NearestPointNode } from "@dafthunk/runtime-legacy/nodes/geo/nearest-point-node";
import { NearestPointOnLineNode } from "@dafthunk/runtime-legacy/nodes/geo/nearest-point-on-line-node";
import { PointNode } from "@dafthunk/runtime-legacy/nodes/geo/point-node";
import { PointOnFeatureNode } from "@dafthunk/runtime-legacy/nodes/geo/point-on-feature-node";
import { PointToLineDistanceNode } from "@dafthunk/runtime-legacy/nodes/geo/point-to-line-distance-node";
import { PointToPolygonDistanceNode } from "@dafthunk/runtime-legacy/nodes/geo/point-to-polygon-distance-node";
import { PolygonNode } from "@dafthunk/runtime-legacy/nodes/geo/polygon-node";
import { PolygonSmoothNode } from "@dafthunk/runtime-legacy/nodes/geo/polygon-smooth-node";
import { PolygonTangentsNode } from "@dafthunk/runtime-legacy/nodes/geo/polygon-tangents-node";
import { PolygonToLineNode } from "@dafthunk/runtime-legacy/nodes/geo/polygon-to-line-node";
import { PolygonizeNode } from "@dafthunk/runtime-legacy/nodes/geo/polygonize-node";
import { RewindNode } from "@dafthunk/runtime-legacy/nodes/geo/rewind-node";
import { RhumbBearingNode } from "@dafthunk/runtime-legacy/nodes/geo/rhumb-bearing-node";
import { RhumbDestinationNode } from "@dafthunk/runtime-legacy/nodes/geo/rhumb-destination-node";
import { RhumbDistanceNode } from "@dafthunk/runtime-legacy/nodes/geo/rhumb-distance-node";
import { RoundNode } from "@dafthunk/runtime-legacy/nodes/geo/round-node";
import { SectorNode } from "@dafthunk/runtime-legacy/nodes/geo/sector-node";
import { ShortestPathNode } from "@dafthunk/runtime-legacy/nodes/geo/shortest-path-node";
import { SimplifyNode } from "@dafthunk/runtime-legacy/nodes/geo/simplify-node";
import { SquareNode } from "@dafthunk/runtime-legacy/nodes/geo/square-node";
import { TransformRotateNode } from "@dafthunk/runtime-legacy/nodes/geo/transform-rotate-node";
import { TransformScaleNode } from "@dafthunk/runtime-legacy/nodes/geo/transform-scale-node";
import { TransformTranslateNode } from "@dafthunk/runtime-legacy/nodes/geo/transform-translate-node";
import { TruncateNode } from "@dafthunk/runtime-legacy/nodes/geo/truncate-node";
import { UnionNode } from "@dafthunk/runtime-legacy/nodes/geo/union-node";
import { UnkinkPolygonNode } from "@dafthunk/runtime-legacy/nodes/geo/unkink-polygon-node";
import { VoronoiNode } from "@dafthunk/runtime-legacy/nodes/geo/voronoi-node";
import { WktGeometryNode } from "@dafthunk/runtime-legacy/nodes/geo/wkt-geometry-node";
import { CreateUpdateFileGithubNode } from "@dafthunk/runtime-legacy/nodes/github/create-update-file-github-node";
import { DeleteFileGithubNode } from "@dafthunk/runtime-legacy/nodes/github/delete-file-github-node";
import { FollowUserGithubNode } from "@dafthunk/runtime-legacy/nodes/github/follow-user-github-node";
import { GetFileContentsGithubNode } from "@dafthunk/runtime-legacy/nodes/github/get-file-contents-github-node";
import { GetRepositoryGithubNode } from "@dafthunk/runtime-legacy/nodes/github/get-repository-github-node";
import { GetUserGithubNode } from "@dafthunk/runtime-legacy/nodes/github/get-user-github-node";
import { ListOrganizationRepositoriesGithubNode } from "@dafthunk/runtime-legacy/nodes/github/list-organization-repositories-github-node";
import { ListUserRepositoriesGithubNode } from "@dafthunk/runtime-legacy/nodes/github/list-user-repositories-github-node";
import { SearchRepositoriesGithubNode } from "@dafthunk/runtime-legacy/nodes/github/search-repositories-github-node";
import { StarRepositoryGithubNode } from "@dafthunk/runtime-legacy/nodes/github/star-repository-github-node";
import { UnfollowUserGithubNode } from "@dafthunk/runtime-legacy/nodes/github/unfollow-user-github-node";
import { UnstarRepositoryGithubNode } from "@dafthunk/runtime-legacy/nodes/github/unstar-repository-github-node";
import { AirQualityGoogleNode } from "@dafthunk/runtime-legacy/nodes/google/air-quality-google-node";
import { ElevationGoogleNode } from "@dafthunk/runtime-legacy/nodes/google/elevation-google-node";
import { GeocodingGoogleNode } from "@dafthunk/runtime-legacy/nodes/google/geocoding-google-node";
import { PlacesGoogleNode } from "@dafthunk/runtime-legacy/nodes/google/places-google-node";
import { PollenGoogleNode } from "@dafthunk/runtime-legacy/nodes/google/pollen-google-node";
import { TimezoneGoogleNode } from "@dafthunk/runtime-legacy/nodes/google/timezone-google-node";
import { WeatherGoogleNode } from "@dafthunk/runtime-legacy/nodes/google/weather-google-node";
import { AddAttendeesGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/add-attendees-google-calendar-node";
import { CheckAvailabilityGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/check-availability-google-calendar-node";
import { CreateEventGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/create-event-google-calendar-node";
import { DeleteEventGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/delete-event-google-calendar-node";
import { GetEventGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/get-event-google-calendar-node";
import { ListCalendarsGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/list-calendars-google-calendar-node";
import { ListEventsGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/list-events-google-calendar-node";
import { QuickAddGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/quick-add-google-calendar-node";
import { SearchEventsGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/search-events-google-calendar-node";
import { UpdateEventGoogleCalendarNode } from "@dafthunk/runtime-legacy/nodes/google-calendar/update-event-google-calendar-node";
// import { ArchiveMessageGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/archive-message-google-mail-node";
// import { CheckDraftGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/check-draft-google-mail-node";
// import { CreateReplyDraftGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/create-reply-draft-google-mail-node";
// import { DeleteDraftGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/delete-draft-google-mail-node";
// import { GetMessageGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/get-message-google-mail-node";
// import { MarkMessageGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/mark-message-google-mail-node";
// import { ModifyLabelsGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/modify-labels-google-mail-node";
// import { ReadInboxGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/read-inbox-google-mail-node";
// import { SearchMessagesGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/search-messages-google-mail-node";
// import { SendDraftGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/send-draft-google-mail-node";
import { SendEmailGoogleMailNode } from "@dafthunk/runtime-legacy/nodes/google-mail/send-email-google-mail-node";
import { HttpRequestNode } from "@dafthunk/runtime-legacy/nodes/http/http-request-node";
import { HttpResponseNode } from "@dafthunk/runtime-legacy/nodes/http/http-response-node";
import { HttpWebhookNode } from "@dafthunk/runtime-legacy/nodes/http/http-webhook-node";
import { JsonBodyNode } from "@dafthunk/runtime-legacy/nodes/http/json-body-node";
import { TestAllTypesNode } from "@dafthunk/runtime-legacy/nodes/http/test-all-types-node";
import { ExifReaderNode } from "@dafthunk/runtime-legacy/nodes/image/exif-reader-node";
import { ImageUrlLoaderNode } from "@dafthunk/runtime-legacy/nodes/image/image-url-loader-node";
import { PhotonAddNoiseNode } from "@dafthunk/runtime-legacy/nodes/image/photon-add-noise-node";
import { PhotonAdjustBrightnessNode } from "@dafthunk/runtime-legacy/nodes/image/photon-adjust-brightness-node";
import { PhotonAdjustContrastNode } from "@dafthunk/runtime-legacy/nodes/image/photon-adjust-contrast-node";
import { PhotonAdjustHslLightnessNode } from "@dafthunk/runtime-legacy/nodes/image/photon-adjust-hsl-lightness-node";
import { PhotonAdjustHueNode } from "@dafthunk/runtime-legacy/nodes/image/photon-adjust-hue-node";
import { PhotonAdjustSaturationNode } from "@dafthunk/runtime-legacy/nodes/image/photon-adjust-saturation-node";
import { PhotonAlterRGBChannelsNode } from "@dafthunk/runtime-legacy/nodes/image/photon-alter-rgb-channels-node";
import { PhotonApplyFilterNode } from "@dafthunk/runtime-legacy/nodes/image/photon-apply-filter-node";
import { PhotonBlendImagesNode } from "@dafthunk/runtime-legacy/nodes/image/photon-blend-images-node";
import { PhotonCropNode } from "@dafthunk/runtime-legacy/nodes/image/photon-crop-node";
import { PhotonEdgeDetectionNode } from "@dafthunk/runtime-legacy/nodes/image/photon-edge-detection-node";
import { PhotonEmbossNode } from "@dafthunk/runtime-legacy/nodes/image/photon-emboss-node";
import { PhotonFitNode } from "@dafthunk/runtime-legacy/nodes/image/photon-fit-node";
import { PhotonFlipImageNode } from "@dafthunk/runtime-legacy/nodes/image/photon-flip-image-node";
import { PhotonGaussianBlurNode } from "@dafthunk/runtime-legacy/nodes/image/photon-gaussian-blur-node";
import { PhotonGrayscaleNode } from "@dafthunk/runtime-legacy/nodes/image/photon-grayscale-node";
import { PhotonImageInfoNode } from "@dafthunk/runtime-legacy/nodes/image/photon-image-info-node";
import { PhotonInvertColorsNode } from "@dafthunk/runtime-legacy/nodes/image/photon-invert-colors-node";
import { PhotonMixWithColorNode } from "@dafthunk/runtime-legacy/nodes/image/photon-mix-with-color-node";
import { PhotonOilPaintingNode } from "@dafthunk/runtime-legacy/nodes/image/photon-oil-painting-node";
import { PhotonPadNode } from "@dafthunk/runtime-legacy/nodes/image/photon-pad-node";
import { PhotonPixelizeNode } from "@dafthunk/runtime-legacy/nodes/image/photon-pixelize-node";
import { PhotonResizeNode } from "@dafthunk/runtime-legacy/nodes/image/photon-resize-node";
import { PhotonRotateImageNode } from "@dafthunk/runtime-legacy/nodes/image/photon-rotate-image-node";
import { PhotonSepiaNode } from "@dafthunk/runtime-legacy/nodes/image/photon-sepia-node";
import { PhotonSharpenNode } from "@dafthunk/runtime-legacy/nodes/image/photon-sharpen-node";
import { PhotonThresholdNode } from "@dafthunk/runtime-legacy/nodes/image/photon-threshold-node";
import { PhotonWatermarkNode } from "@dafthunk/runtime-legacy/nodes/image/photon-watermark-node";
import { SvgToPngNode } from "@dafthunk/runtime-legacy/nodes/image/svg-to-png-node";
import { AudioInputNode } from "@dafthunk/runtime-legacy/nodes/input/audio-input-node";
import { AudioRecorderInputNode } from "@dafthunk/runtime-legacy/nodes/input/audio-recorder-input-node";
import { BlobInputNode } from "@dafthunk/runtime-legacy/nodes/input/blob-input-node";
import { BooleanInputNode } from "@dafthunk/runtime-legacy/nodes/input/boolean-input-node";
import { CanvasInputNode } from "@dafthunk/runtime-legacy/nodes/input/canvas-input-node";
import { DateInputNode } from "@dafthunk/runtime-legacy/nodes/input/date-input-node";
import { DocumentInputNode } from "@dafthunk/runtime-legacy/nodes/input/document-input-node";
import { GeoJSONInputNode } from "@dafthunk/runtime-legacy/nodes/input/geojson-input-node";
import { GltfInputNode } from "@dafthunk/runtime-legacy/nodes/input/gltf-input-node";
import { ImageInputNode } from "@dafthunk/runtime-legacy/nodes/input/image-input-node";
import { JavaScriptInputNode } from "@dafthunk/runtime-legacy/nodes/input/javascript-input-node";
import { JsonInputNode } from "@dafthunk/runtime-legacy/nodes/input/json-input-node";
import { NumberInputNode } from "@dafthunk/runtime-legacy/nodes/input/number-input-node";
import { SecretInputNode } from "@dafthunk/runtime-legacy/nodes/input/secret-input-node";
import { SliderInputNode } from "@dafthunk/runtime-legacy/nodes/input/slider-input-node";
import { TextInputNode } from "@dafthunk/runtime-legacy/nodes/input/text-input-node";
import { VideoInputNode } from "@dafthunk/runtime-legacy/nodes/input/video-input-node";
import { WebcamInputNode } from "@dafthunk/runtime-legacy/nodes/input/webcam-input-node";
import { JavascriptNode } from "@dafthunk/runtime-legacy/nodes/javascript/javascript-node";
import { JsonAggNode } from "@dafthunk/runtime-legacy/nodes/json/json-agg-node";
import { JsonArrayLengthNode } from "@dafthunk/runtime-legacy/nodes/json/json-array-length-node";
import { JsonContainsNode } from "@dafthunk/runtime-legacy/nodes/json/json-contains-node";
import { JsonContainsPathNode } from "@dafthunk/runtime-legacy/nodes/json/json-contains-path-node";
import { JsonExecuteJavascriptNode } from "@dafthunk/runtime-legacy/nodes/json/json-execute-javascript-node";
import { JsonExtractAllNode } from "@dafthunk/runtime-legacy/nodes/json/json-extract-all-node";
import { JsonExtractBooleanNode } from "@dafthunk/runtime-legacy/nodes/json/json-extract-boolean-node";
import { JsonExtractNumberNode } from "@dafthunk/runtime-legacy/nodes/json/json-extract-number-node";
import { JsonExtractObjectNode } from "@dafthunk/runtime-legacy/nodes/json/json-extract-object-node";
import { JsonExtractStringNode } from "@dafthunk/runtime-legacy/nodes/json/json-extract-string-node";
import { JsonFlattenNode } from "@dafthunk/runtime-legacy/nodes/json/json-flatten-node";
import { JsonInsertNode } from "@dafthunk/runtime-legacy/nodes/json/json-insert-node";
import { JsonKeysNode } from "@dafthunk/runtime-legacy/nodes/json/json-keys-node";
import { JsonMergeNode } from "@dafthunk/runtime-legacy/nodes/json/json-merge-node";
import { JsonObjectAggNode } from "@dafthunk/runtime-legacy/nodes/json/json-object-agg-node";
import { JsonObjectKeysNode } from "@dafthunk/runtime-legacy/nodes/json/json-object-keys-node";
import { JsonObjectValuesNode } from "@dafthunk/runtime-legacy/nodes/json/json-object-values-node";
import { JsonRemoveNode } from "@dafthunk/runtime-legacy/nodes/json/json-remove-node";
import { JsonReplaceNode } from "@dafthunk/runtime-legacy/nodes/json/json-replace-node";
import { JsonSchemaComposeNode } from "@dafthunk/runtime-legacy/nodes/json/json-schema-compose-node";
import { JsonSchemaExtractNode } from "@dafthunk/runtime-legacy/nodes/json/json-schema-extract-node";
import { JsonSetNode } from "@dafthunk/runtime-legacy/nodes/json/json-set-node";
import { JsonStripNullsNode } from "@dafthunk/runtime-legacy/nodes/json/json-strip-nulls-node";
import { JsonTemplateNode } from "@dafthunk/runtime-legacy/nodes/json/json-template-node";
import { JsonToGeojsonNode } from "@dafthunk/runtime-legacy/nodes/json/json-to-geojson-node";
import { JsonTypeofNode } from "@dafthunk/runtime-legacy/nodes/json/json-typeof-node";
import { JsonValidNode } from "@dafthunk/runtime-legacy/nodes/json/json-valid-node";
import { CommentOnPostLinkedInNode } from "@dafthunk/runtime-legacy/nodes/linkedin/comment-on-post-linkedin-node";
import { GetPostCommentsLinkedInNode } from "@dafthunk/runtime-legacy/nodes/linkedin/get-post-comments-linkedin-node";
import { GetPostLikesLinkedInNode } from "@dafthunk/runtime-legacy/nodes/linkedin/get-post-likes-linkedin-node";
import { GetProfileLinkedInNode } from "@dafthunk/runtime-legacy/nodes/linkedin/get-profile-linkedin-node";
import { LikePostLinkedInNode } from "@dafthunk/runtime-legacy/nodes/linkedin/like-post-linkedin-node";
import { SharePostLinkedInNode } from "@dafthunk/runtime-legacy/nodes/linkedin/share-post-linkedin-node";
import { ConditionalForkNode } from "@dafthunk/runtime-legacy/nodes/logic/conditional-fork-node";
import { ConditionalJoinNode } from "@dafthunk/runtime-legacy/nodes/logic/conditional-join-node";
import { CreateFeedbackFormNode } from "@dafthunk/runtime-legacy/nodes/logic/create-feedback-form-node";
import { CreateFormNode } from "@dafthunk/runtime-legacy/nodes/logic/create-form-node";
import { SwitchForkNode } from "@dafthunk/runtime-legacy/nodes/logic/switch-fork-node";
import { SwitchJoinNode } from "@dafthunk/runtime-legacy/nodes/logic/switch-join-node";
import { WaitForFormNode } from "@dafthunk/runtime-legacy/nodes/logic/wait-for-form-node";
import { AbsoluteValueNode } from "@dafthunk/runtime-legacy/nodes/math/absolute-value-node";
import { AdditionNode } from "@dafthunk/runtime-legacy/nodes/math/addition-node";
import { AvgNode } from "@dafthunk/runtime-legacy/nodes/math/avg-node";
import { CalculatorNode } from "@dafthunk/runtime-legacy/nodes/math/calculator-node";
import { DivisionNode } from "@dafthunk/runtime-legacy/nodes/math/division-node";
import { ExponentiationNode } from "@dafthunk/runtime-legacy/nodes/math/exponentiation-node";
import { MaxNode } from "@dafthunk/runtime-legacy/nodes/math/max-node";
import { MedianNode } from "@dafthunk/runtime-legacy/nodes/math/median-node";
import { MinNode } from "@dafthunk/runtime-legacy/nodes/math/min-node";
import { ModuloNode } from "@dafthunk/runtime-legacy/nodes/math/modulo-node";
import { MultiplicationNode } from "@dafthunk/runtime-legacy/nodes/math/multiplication-node";
import { SquareRootNode } from "@dafthunk/runtime-legacy/nodes/math/square-root-node";
import { SubtractionNode } from "@dafthunk/runtime-legacy/nodes/math/subtraction-node";
import { SumNode } from "@dafthunk/runtime-legacy/nodes/math/sum-node";
import { Gpt5MiniNode } from "@dafthunk/runtime-legacy/nodes/openai/gpt-5-mini-node";
import { Gpt5NanoNode } from "@dafthunk/runtime-legacy/nodes/openai/gpt-5-nano-node";
import { Gpt5Node } from "@dafthunk/runtime-legacy/nodes/openai/gpt-5-node";
import { Gpt41Node } from "@dafthunk/runtime-legacy/nodes/openai/gpt-41-node";
import { AnyOutputNode } from "@dafthunk/runtime-legacy/nodes/output/any-output-node";
import { AudioOutputNode } from "@dafthunk/runtime-legacy/nodes/output/audio-output-node";
import { BlobOutputNode } from "@dafthunk/runtime-legacy/nodes/output/blob-output-node";
import { BooleanOutputNode } from "@dafthunk/runtime-legacy/nodes/output/boolean-output-node";
import { DateOutputNode } from "@dafthunk/runtime-legacy/nodes/output/date-output-node";
import { DocumentOutputNode } from "@dafthunk/runtime-legacy/nodes/output/document-output-node";
import { GeoJSONOutputNode } from "@dafthunk/runtime-legacy/nodes/output/geojson-output-node";
import { GltfOutputNode } from "@dafthunk/runtime-legacy/nodes/output/gltf-output-node";
import { ImageOutputNode } from "@dafthunk/runtime-legacy/nodes/output/image-output-node";
import { JsonOutputNode } from "@dafthunk/runtime-legacy/nodes/output/json-output-node";
import { NumberOutputNode } from "@dafthunk/runtime-legacy/nodes/output/number-output-node";
import { SecretOutputNode } from "@dafthunk/runtime-legacy/nodes/output/secret-output-node";
import { TextOutputNode } from "@dafthunk/runtime-legacy/nodes/output/text-output-node";
import { VideoOutputNode } from "@dafthunk/runtime-legacy/nodes/output/video-output-node";
import { ReceiveQueueMessageNode } from "@dafthunk/runtime-legacy/nodes/queue/receive-queue-message-node";
import { SendQueueBatchNode } from "@dafthunk/runtime-legacy/nodes/queue/send-queue-batch-node";
import { SendQueueMessageNode } from "@dafthunk/runtime-legacy/nodes/queue/send-queue-message-node";
import { RandomChoiceNode } from "@dafthunk/runtime-legacy/nodes/random/random-choice-node";
import { RandomNumberNode } from "@dafthunk/runtime-legacy/nodes/random/random-number-node";
import { RandomStringNode } from "@dafthunk/runtime-legacy/nodes/random/random-string-node";
import { RandomUuidNode } from "@dafthunk/runtime-legacy/nodes/random/random-uuid-node";
import { GetPostRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/get-post-reddit-node";
import { GetSubredditRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/get-subreddit-reddit-node";
import { GetUserRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/get-user-reddit-node";
import { ListCommentsRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/list-comments-reddit-node";
import { ListPostsRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/list-posts-reddit-node";
import { ListUserCommentsRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/list-user-comments-reddit-node";
import { ListUserPostsRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/list-user-posts-reddit-node";
import { SearchRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/search-reddit-node";
import { SearchSubredditsRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/search-subreddits-reddit-node";
import { SharePostRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/share-post-reddit-node";
import { SubmitCommentRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/submit-comment-reddit-node";
import { VoteRedditNode } from "@dafthunk/runtime-legacy/nodes/reddit/vote-reddit-node";
import { ReplicateModelNode } from "@dafthunk/runtime-legacy/nodes/replicate/replicate-model-node";
import { RelayAiNode } from "@dafthunk/runtime-legacy/nodes/relay/relay-ai-node";
import { BashNode } from "@dafthunk/runtime-legacy/nodes/sandbox/bash-node";
import { CNode } from "@dafthunk/runtime-legacy/nodes/sandbox/c-node";
import { GoNode } from "@dafthunk/runtime-legacy/nodes/sandbox/go-node";
import { JavaNode } from "@dafthunk/runtime-legacy/nodes/sandbox/java-node";
import { NodejsNode } from "@dafthunk/runtime-legacy/nodes/sandbox/nodejs-node";
import { PythonNode } from "@dafthunk/runtime-legacy/nodes/sandbox/python-node";
import { RustNode } from "@dafthunk/runtime-legacy/nodes/sandbox/rust-node";
import { TypescriptNode } from "@dafthunk/runtime-legacy/nodes/sandbox/typescript-node";
import { ReceiveScheduledTriggerNode } from "@dafthunk/runtime-legacy/nodes/scheduled/receive-scheduled-trigger-node";
import { BotAddReactionSlackNode } from "@dafthunk/runtime-legacy/nodes/slack/bot-add-reaction-slack-node";
import { BotReceiveSlackMessageNode } from "@dafthunk/runtime-legacy/nodes/slack/bot-receive-slack-message-node";
import { BotSendMessageSlackNode } from "@dafthunk/runtime-legacy/nodes/slack/bot-send-message-slack-node";
import { ExtractTavilyNode } from "@dafthunk/runtime-legacy/nodes/tavily/extract-tavily-node";
import { SearchTavilyNode } from "@dafthunk/runtime-legacy/nodes/tavily/search-tavily-node";
import { BotForwardMessageTelegramNode } from "@dafthunk/runtime-legacy/nodes/telegram/bot-forward-message-telegram-node";
import { BotGetChatTelegramNode } from "@dafthunk/runtime-legacy/nodes/telegram/bot-get-chat-telegram-node";
import { BotReceiveTelegramMessageNode } from "@dafthunk/runtime-legacy/nodes/telegram/bot-receive-telegram-message-node";
import { BotSendMessageTelegramNode } from "@dafthunk/runtime-legacy/nodes/telegram/bot-send-message-telegram-node";
import { BotSendPhotoTelegramNode } from "@dafthunk/runtime-legacy/nodes/telegram/bot-send-photo-telegram-node";
import { JsonStringTemplateNode } from "@dafthunk/runtime-legacy/nodes/text/json-string-template-node";
import { RegexExtractNode } from "@dafthunk/runtime-legacy/nodes/text/regex-extract-node";
import { RegexMatchNode } from "@dafthunk/runtime-legacy/nodes/text/regex-match-node";
import { RegexReplaceNode } from "@dafthunk/runtime-legacy/nodes/text/regex-replace-node";
import { RegexSplitNode } from "@dafthunk/runtime-legacy/nodes/text/regex-split-node";
import { StringConcatNode } from "@dafthunk/runtime-legacy/nodes/text/string-concat-node";
import { StringEqualsNode } from "@dafthunk/runtime-legacy/nodes/text/string-equals-node";
import { StringIncludesNode } from "@dafthunk/runtime-legacy/nodes/text/string-includes-node";
import { StringIndexOfNode } from "@dafthunk/runtime-legacy/nodes/text/string-index-of-node";
import { StringLastIndexOfNode } from "@dafthunk/runtime-legacy/nodes/text/string-last-index-of-node";
import { StringNormalizeNode } from "@dafthunk/runtime-legacy/nodes/text/string-normalize-node";
import { StringSubstringNode } from "@dafthunk/runtime-legacy/nodes/text/string-substring-node";
import { StringToLowerCaseNode } from "@dafthunk/runtime-legacy/nodes/text/string-to-lower-case-node";
import { StringToUpperCaseNode } from "@dafthunk/runtime-legacy/nodes/text/string-to-upper-case-node";
import { StringTrimNode } from "@dafthunk/runtime-legacy/nodes/text/string-trim-node";
import { ToJsonNode } from "@dafthunk/runtime-legacy/nodes/text/to-json-node";
import { ToStringNode } from "@dafthunk/runtime-legacy/nodes/text/to-string-node";
import { TwilioSmsNode } from "@dafthunk/runtime-legacy/nodes/text/twilio-sms-node";
import { VarStringTemplateNode } from "@dafthunk/runtime-legacy/nodes/text/var-string-template-node";
import { AppendVideosNode } from "@dafthunk/runtime-legacy/nodes/video/append-videos-node";
import { ClipVideoNode } from "@dafthunk/runtime-legacy/nodes/video/clip-video-node";
import { ExtractFirstFrameNode } from "@dafthunk/runtime-legacy/nodes/video/extract-first-frame-node";
import { ExtractFrameAtTimeNode } from "@dafthunk/runtime-legacy/nodes/video/extract-frame-at-time-node";
import { ExtractLastFrameNode } from "@dafthunk/runtime-legacy/nodes/video/extract-last-frame-node";
import { OverlayImageOnVideoNode } from "@dafthunk/runtime-legacy/nodes/video/overlay-image-on-video-node";
import { BotMarkAsReadWhatsAppNode } from "@dafthunk/runtime-legacy/nodes/whatsapp/bot-mark-as-read-whatsapp-node";
import { BotReceiveWhatsAppMessageNode } from "@dafthunk/runtime-legacy/nodes/whatsapp/bot-receive-whatsapp-message-node";
import { BotSendImageWhatsAppNode } from "@dafthunk/runtime-legacy/nodes/whatsapp/bot-send-image-whatsapp-node";
import { BotSendMessageWhatsAppNode } from "@dafthunk/runtime-legacy/nodes/whatsapp/bot-send-message-whatsapp-node";
import { BotSendTemplateWhatsAppNode } from "@dafthunk/runtime-legacy/nodes/whatsapp/bot-send-template-whatsapp-node";
import { SearchMediaWikiNode } from "@dafthunk/runtime-legacy/nodes/wikipedia/search-mediawiki-node";
import { SearchWikipediaNode } from "@dafthunk/runtime-legacy/nodes/wikipedia/search-wikipedia-node";
import { CreatePostWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/create-post-wordpress-node";
import { CreateTagWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/create-tag-wordpress-node";
import { DeletePostWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/delete-post-wordpress-node";
import { GetPostWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/get-post-wordpress-node";
import { GetSiteWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/get-site-wordpress-node";
import { ListCategoriesWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/list-categories-wordpress-node";
import { ListPostsWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/list-posts-wordpress-node";
import { SearchWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/search-wordpress-node";
import { UpdatePostWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/update-post-wordpress-node";
import { UploadMediaWordPressNode } from "@dafthunk/runtime-legacy/nodes/wordpress/upload-media-wordpress-node";
import { DeletePostXNode } from "@dafthunk/runtime-legacy/nodes/x/delete-post-x-node";
import { FollowUserXNode } from "@dafthunk/runtime-legacy/nodes/x/follow-user-x-node";
import { GetPostXNode } from "@dafthunk/runtime-legacy/nodes/x/get-post-x-node";
import { GetUserXNode } from "@dafthunk/runtime-legacy/nodes/x/get-user-x-node";
import { LikePostXNode } from "@dafthunk/runtime-legacy/nodes/x/like-post-x-node";
import { ListFollowersXNode } from "@dafthunk/runtime-legacy/nodes/x/list-followers-x-node";
import { ListFollowingXNode } from "@dafthunk/runtime-legacy/nodes/x/list-following-x-node";
import { ListUserMentionsXNode } from "@dafthunk/runtime-legacy/nodes/x/list-user-mentions-x-node";
import { ListUserPostsXNode } from "@dafthunk/runtime-legacy/nodes/x/list-user-posts-x-node";
import { RepostXNode } from "@dafthunk/runtime-legacy/nodes/x/repost-x-node";
import { SearchPostsXNode } from "@dafthunk/runtime-legacy/nodes/x/search-posts-x-node";
import { SharePostXNode } from "@dafthunk/runtime-legacy/nodes/x/share-post-x-node";

export function registerLegacyNodeImplementations<Env>(
  registry: BaseNodeRegistry<Env>,
  env: Env
): void {
    // Initialize environment feature flags as local variables
    const hasCloudflare = !!(
      env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN
    );
    const hasTwilioSms = !!(
      env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_PHONE_NUMBER
    );
    const hasSendEmail = !!(env.SEND_EMAIL && env.SEND_EMAIL_FROM);
    const hasGoogleMail = !!(
      env.INTEGRATION_GOOGLE_MAIL_CLIENT_ID &&
      env.INTEGRATION_GOOGLE_MAIL_CLIENT_SECRET
    );
    const hasGoogleCalendar = !!(
      env.INTEGRATION_GOOGLE_CALENDAR_CLIENT_ID &&
      env.INTEGRATION_GOOGLE_CALENDAR_CLIENT_SECRET
    );
    const hasDiscord = !!(
      env.INTEGRATION_DISCORD_CLIENT_ID &&
      env.INTEGRATION_DISCORD_CLIENT_SECRET
    );

    const hasGitHub = !!(
      env.INTEGRATION_GITHUB_CLIENT_ID &&
      env.INTEGRATION_GITHUB_CLIENT_SECRET
    );
    const hasReddit = !!(
      env.INTEGRATION_REDDIT_CLIENT_ID &&
      env.INTEGRATION_REDDIT_CLIENT_SECRET
    );
    const hasLinkedIn = !!(
      env.INTEGRATION_LINKEDIN_CLIENT_ID &&
      env.INTEGRATION_LINKEDIN_CLIENT_SECRET
    );
    const hasX = !!(
      env.INTEGRATION_X_CLIENT_ID && env.INTEGRATION_X_CLIENT_SECRET
    );
    const hasWordPress = !!(
      env.INTEGRATION_WORDPRESS_CLIENT_ID &&
      env.INTEGRATION_WORDPRESS_CLIENT_SECRET
    );

    // Register all core nodes
    registry.registerImplementation(HttpRequestNode);
    registry.registerImplementation(HttpWebhookNode);
    registry.registerImplementation(FormRequestNode);
    registry.registerImplementation(FormWebhookNode);
    registry.registerImplementation(FormResponseNode);
    registry.registerImplementation(JsonBodyNode);
    registry.registerImplementation(TestAllTypesNode);
    registry.registerImplementation(SendQueueMessageNode);
    registry.registerImplementation(SendQueueBatchNode);
    registry.registerImplementation(ReceiveQueueMessageNode);
    registry.registerImplementation(DatabaseCreateTableNode);
    registry.registerImplementation(DatabaseDeleteRowNode);
    registry.registerImplementation(DatabaseDescribeTableNode);
    registry.registerImplementation(DatabaseDropTableNode);
    registry.registerImplementation(DatabaseExecuteNode);
    registry.registerImplementation(DatabaseExportTableNode);
    registry.registerImplementation(DatabaseGetRowCountNode);
    registry.registerImplementation(DatabaseGetRowNode);
    registry.registerImplementation(DatabaseImportTableNode);
    registry.registerImplementation(DatabaseListTablesNode);
    registry.registerImplementation(DatabasePutRowNode);
    registry.registerImplementation(DatabaseQueryNode);
    registry.registerImplementation(DatabaseRowExistsNode);
    registry.registerImplementation(DatabaseTableExistsNode);
    registry.registerImplementation(DatabaseTruncateTableNode);
    registry.registerImplementation(ParquetQueryNode);
    registry.registerImplementation(ReceiveEmailNode);
    registry.registerImplementation(BotReceiveDiscordMessageNode);
    registry.registerImplementation(BotReceiveTelegramMessageNode);
    registry.registerImplementation(ReceiveScheduledTriggerNode);
    registry.registerImplementation(ParseEmailNode);
    registry.registerImplementation(ExtractEmailAttachmentsNode);
    registry.registerImplementation(GetEmailThreadNode);
    registry.registerImplementation(AdditionNode);
    registry.registerImplementation(SubtractionNode);
    registry.registerImplementation(MultiplicationNode);
    registry.registerImplementation(DivisionNode);
    registry.registerImplementation(ModuloNode);
    registry.registerImplementation(ExponentiationNode);
    registry.registerImplementation(SquareRootNode);
    registry.registerImplementation(AbsoluteValueNode);
    registry.registerImplementation(CalculatorNode);
    registry.registerImplementation(SumNode);
    registry.registerImplementation(MaxNode);
    registry.registerImplementation(MinNode);
    registry.registerImplementation(AvgNode);
    registry.registerImplementation(MedianNode);
    registry.registerImplementation(RandomChoiceNode);
    registry.registerImplementation(RandomNumberNode);
    registry.registerImplementation(RandomStringNode);
    registry.registerImplementation(RandomUuidNode);
    registry.registerImplementation(TextInputNode);
    registry.registerImplementation(ToStringNode);
    registry.registerImplementation(NumberInputNode);
    registry.registerImplementation(SliderInputNode);
    registry.registerImplementation(ImageUrlLoaderNode);
    registry.registerImplementation(JsonAggNode);
    registry.registerImplementation(ExtractItemNode);
    registry.registerImplementation(AggregateItemsNode);
    registry.registerImplementation(JsonExtractStringNode);
    registry.registerImplementation(JsonExtractBooleanNode);
    registry.registerImplementation(JsonExtractNumberNode);
    registry.registerImplementation(JsonExtractObjectNode);
    registry.registerImplementation(JsonExtractAllNode);
    registry.registerImplementation(JsonExecuteJavascriptNode);
    registry.registerImplementation(JsonTemplateNode);
    registry.registerImplementation(JsonInputNode);

    // Date nodes
    registry.registerImplementation(DateInputNode);
    registry.registerImplementation(NowDateNode);
    registry.registerImplementation(ParseDateNode);
    registry.registerImplementation(AddDateNode);
    registry.registerImplementation(DiffDateNode);
    registry.registerImplementation(JsonArrayLengthNode);
    registry.registerImplementation(JsonContainsNode);
    registry.registerImplementation(JsonContainsPathNode);
    registry.registerImplementation(JsonFlattenNode);
    registry.registerImplementation(JsonInsertNode);
    registry.registerImplementation(JsonKeysNode);
    registry.registerImplementation(JsonMergeNode);
    registry.registerImplementation(JsonObjectAggNode);
    registry.registerImplementation(JsonObjectKeysNode);
    registry.registerImplementation(JsonObjectValuesNode);
    registry.registerImplementation(JsonRemoveNode);
    registry.registerImplementation(JsonReplaceNode);
    registry.registerImplementation(JsonSetNode);
    registry.registerImplementation(JsonStripNullsNode);
    registry.registerImplementation(JsonToBlobNode);
    registry.registerImplementation(JsonToGeojsonNode);
    registry.registerImplementation(JsonTypeofNode);
    registry.registerImplementation(JsonSchemaComposeNode);
    registry.registerImplementation(JsonSchemaExtractNode);
    registry.registerImplementation(JsonValidNode);
    registry.registerImplementation(JsonStringTemplateNode);
    registry.registerImplementation(VarStringTemplateNode);
    registry.registerImplementation(JavaScriptInputNode);
    registry.registerImplementation(JavascriptNode);
    registry.registerImplementation(CanvasInputNode);
    registry.registerImplementation(ExifReaderNode);
    registry.registerImplementation(WebcamInputNode);

    // String operations
    registry.registerImplementation(StringConcatNode);
    registry.registerImplementation(StringEqualsNode);
    registry.registerImplementation(StringIncludesNode);
    registry.registerImplementation(StringIndexOfNode);
    registry.registerImplementation(StringLastIndexOfNode);
    registry.registerImplementation(StringNormalizeNode);
    registry.registerImplementation(StringSubstringNode);
    registry.registerImplementation(StringToLowerCaseNode);
    registry.registerImplementation(StringToUpperCaseNode);
    registry.registerImplementation(StringTrimNode);
    registry.registerImplementation(RegexMatchNode);
    registry.registerImplementation(RegexExtractNode);
    registry.registerImplementation(RegexReplaceNode);
    registry.registerImplementation(RegexSplitNode);
    registry.registerImplementation(ToJsonNode);
    registry.registerImplementation(BooleanInputNode);
    registry.registerImplementation(ConditionalForkNode);
    registry.registerImplementation(ConditionalJoinNode);
    registry.registerImplementation(SwitchForkNode);
    registry.registerImplementation(SwitchJoinNode);
    registry.registerImplementation(CreateFormNode);
    registry.registerImplementation(CreateFeedbackFormNode);
    registry.registerImplementation(WaitForFormNode);

    // Image operations
    registry.registerImplementation(PhotonAddNoiseNode);
    registry.registerImplementation(PhotonAdjustBrightnessNode);
    registry.registerImplementation(PhotonAdjustContrastNode);
    registry.registerImplementation(PhotonAdjustHslLightnessNode);
    registry.registerImplementation(PhotonAdjustHueNode);
    registry.registerImplementation(PhotonAdjustSaturationNode);
    registry.registerImplementation(PhotonAlterRGBChannelsNode);
    registry.registerImplementation(PhotonApplyFilterNode);
    registry.registerImplementation(PhotonBlendImagesNode);
    registry.registerImplementation(PhotonCropNode);
    registry.registerImplementation(PhotonEdgeDetectionNode);
    registry.registerImplementation(PhotonEmbossNode);
    registry.registerImplementation(PhotonFitNode);
    registry.registerImplementation(PhotonFlipImageNode);
    registry.registerImplementation(PhotonGaussianBlurNode);
    registry.registerImplementation(PhotonGrayscaleNode);
    registry.registerImplementation(PhotonImageInfoNode);
    registry.registerImplementation(PhotonInvertColorsNode);
    registry.registerImplementation(PhotonMixWithColorNode);
    registry.registerImplementation(PhotonOilPaintingNode);
    registry.registerImplementation(PhotonPadNode);
    registry.registerImplementation(PhotonPixelizeNode);
    registry.registerImplementation(PhotonResizeNode);
    registry.registerImplementation(PhotonRotateImageNode);
    registry.registerImplementation(PhotonSepiaNode);
    registry.registerImplementation(PhotonSharpenNode);
    registry.registerImplementation(PhotonThresholdNode);
    registry.registerImplementation(PhotonWatermarkNode);
    registry.registerImplementation(SvgToPngNode);

    // Generic Replicate model node
    registry.registerImplementation(ReplicateModelNode);
    registry.registerImplementation(RelayAiNode);

    // Generic Cloudflare Workers AI model node
    registry.registerImplementation(CloudflareModelNode);
    registry.registerImplementation(AiInterfaceNode);

    // Generic Cloudflare Gateway (unified author/model) node
    registry.registerImplementation(CloudflareGatewayModelNode);

    // Video processing nodes (Cloudflare Containers)
    if (env.FFMPEG_CONTAINER) {
      registry.registerImplementation(AppendVideosNode);
      registry.registerImplementation(ClipVideoNode);
      registry.registerImplementation(ExtractFrameAtTimeNode);
      registry.registerImplementation(ExtractFirstFrameNode);
      registry.registerImplementation(ExtractLastFrameNode);
      registry.registerImplementation(OverlayImageOnVideoNode);
    }

    // Multi-language sandbox nodes (Cloudflare Containers)
    if (env.SANDBOX) {
      registry.registerImplementation(PythonNode);
      registry.registerImplementation(BashNode);
      registry.registerImplementation(NodejsNode);
      registry.registerImplementation(TypescriptNode);
      registry.registerImplementation(GoNode);
      registry.registerImplementation(CNode);
      registry.registerImplementation(RustNode);
      registry.registerImplementation(JavaNode);
    }

    registry.registerImplementation(AudioInputNode);
    registry.registerImplementation(AudioRecorderInputNode);
    registry.registerImplementation(ImageInputNode);
    registry.registerImplementation(BlobInputNode);
    registry.registerImplementation(DocumentInputNode);
    registry.registerImplementation(GltfInputNode);
    registry.registerImplementation(GeoJSONInputNode);
    registry.registerImplementation(VideoInputNode);
    registry.registerImplementation(SecretInputNode);

    registry.registerImplementation(CsvExtractColumnNode);
    registry.registerImplementation(CsvFilterRowsNode);
    registry.registerImplementation(CsvParseNode);
    registry.registerImplementation(CsvStringifyNode);
    registry.registerImplementation(ToMarkdownNode);
    registry.registerImplementation(FileNode);
    registry.registerImplementation(BlobToFormDataNode);
    registry.registerImplementation(BlobToJsonNode);
    registry.registerImplementation(BlobToTextNode);
    registry.registerImplementation(JsonToBlobNode);
    registry.registerImplementation(TextToBlobNode);
    registry.registerImplementation(FetchNode);
    registry.registerImplementation(HttpResponseNode);

    // Search nodes
    registry.registerImplementation(SearchWikipediaNode);
    registry.registerImplementation(SearchMediaWikiNode);

    // Tavily nodes
    if (env.TAVILY_API_KEY) {
      registry.registerImplementation(SearchTavilyNode);
      registry.registerImplementation(ExtractTavilyNode);
    }

    // Google API nodes
    if (env.GOOGLE_API_KEY) {
      registry.registerImplementation(AirQualityGoogleNode);
      registry.registerImplementation(WeatherGoogleNode);
      registry.registerImplementation(PollenGoogleNode);
      registry.registerImplementation(ElevationGoogleNode);
      registry.registerImplementation(PlacesGoogleNode);
      registry.registerImplementation(GeocodingGoogleNode);
      registry.registerImplementation(TimezoneGoogleNode);
    }

    // Specification test nodes (multi-step)
    registry.registerImplementation(MultiStepAdditionNode);
    registry.registerImplementation(FailingMultiStepNode);

    // Conditional registrations based on environment
    if (hasCloudflare) {
      registry.registerImplementation(CloudflareBrowserContentNode);
      registry.registerImplementation(CloudflareBrowserCrawlNode);
      registry.registerImplementation(CloudflareBrowserCrawlQueueNode);
      registry.registerImplementation(CloudflareBrowserJsonNode);
      registry.registerImplementation(CloudflareBrowserLinksNode);
      registry.registerImplementation(CloudflareBrowserMarkdownNode);
      registry.registerImplementation(CloudflareBrowserPdfNode);
      registry.registerImplementation(CloudflareBrowserScreenshotNode);
      registry.registerImplementation(CloudflareBrowserScrapeNode);
      registry.registerImplementation(CloudflareBrowserSnapshotNode);
    }

    if (hasTwilioSms) {
      registry.registerImplementation(TwilioSmsNode);
    }

    if (hasSendEmail) {
      registry.registerImplementation(SendEmailNode);
      // Email coordination agent �?sends + waits for replies via Durable Object
      registry.registerImplementation(EmailAgentClaudeSonnet4Node);
    }

    if (hasGoogleMail) {
      // gmail.send scope only (non-restricted)
      registry.registerImplementation(SendEmailGoogleMailNode);

      // Restricted scopes - require Google security audit
      // if (this.developerMode) {
      //   registry.registerImplementation(CreateReplyDraftGoogleMailNode);
      //   registry.registerImplementation(CheckDraftGoogleMailNode);
      //   registry.registerImplementation(SendDraftGoogleMailNode);
      //   registry.registerImplementation(DeleteDraftGoogleMailNode);
      //   registry.registerImplementation(UpdateDraftGoogleMailNode);
      //   registry.registerImplementation(ReadInboxGoogleMailNode);
      //   registry.registerImplementation(MarkMessageGoogleMailNode);
      //   registry.registerImplementation(ModifyLabelsGoogleMailNode);
      //   registry.registerImplementation(SearchMessagesGoogleMailNode);
      //   registry.registerImplementation(GetMessageGoogleMailNode);
      //   registry.registerImplementation(ArchiveMessageGoogleMailNode);
      //   registry.registerImplementation(TrashMessageGoogleMailNode);
      // }
    }

    if (hasGoogleCalendar) {
      registry.registerImplementation(CreateEventGoogleCalendarNode);
      registry.registerImplementation(ListEventsGoogleCalendarNode);
      registry.registerImplementation(GetEventGoogleCalendarNode);
      registry.registerImplementation(UpdateEventGoogleCalendarNode);
      registry.registerImplementation(DeleteEventGoogleCalendarNode);
      registry.registerImplementation(SearchEventsGoogleCalendarNode);
      registry.registerImplementation(AddAttendeesGoogleCalendarNode);
      registry.registerImplementation(CheckAvailabilityGoogleCalendarNode);
      registry.registerImplementation(QuickAddGoogleCalendarNode);
      registry.registerImplementation(ListCalendarsGoogleCalendarNode);
    }

    if (hasDiscord) {
      registry.registerImplementation(SendMessageDiscordNode);
      registry.registerImplementation(SendDMDiscordNode);
      registry.registerImplementation(GetChannelDiscordNode);
      registry.registerImplementation(ListGuildChannelsDiscordNode);
      registry.registerImplementation(GetGuildDiscordNode);
      registry.registerImplementation(ListUserGuildsDiscordNode);
      registry.registerImplementation(AddReactionDiscordNode);
    }

    registry.registerImplementation(BotSendMessageDiscordNode);
    registry.registerImplementation(BotSendDMDiscordNode);
    registry.registerImplementation(BotAddReactionDiscordNode);

    registry.registerImplementation(BotSendMessageTelegramNode);
    registry.registerImplementation(BotSendPhotoTelegramNode);
    registry.registerImplementation(BotForwardMessageTelegramNode);
    registry.registerImplementation(BotGetChatTelegramNode);

    registry.registerImplementation(BotReceiveWhatsAppMessageNode);
    registry.registerImplementation(BotSendMessageWhatsAppNode);
    registry.registerImplementation(BotSendImageWhatsAppNode);
    registry.registerImplementation(BotSendTemplateWhatsAppNode);
    registry.registerImplementation(BotMarkAsReadWhatsAppNode);

    registry.registerImplementation(BotReceiveSlackMessageNode);
    registry.registerImplementation(BotSendMessageSlackNode);
    registry.registerImplementation(BotAddReactionSlackNode);

    if (hasReddit) {
      registry.registerImplementation(GetPostRedditNode);
      registry.registerImplementation(GetSubredditRedditNode);
      registry.registerImplementation(GetUserRedditNode);
      registry.registerImplementation(ListCommentsRedditNode);
      registry.registerImplementation(ListPostsRedditNode);
      registry.registerImplementation(ListUserCommentsRedditNode);
      registry.registerImplementation(ListUserPostsRedditNode);
      registry.registerImplementation(SearchRedditNode);
      registry.registerImplementation(SearchSubredditsRedditNode);
      registry.registerImplementation(SubmitCommentRedditNode);
      registry.registerImplementation(SharePostRedditNode);
      registry.registerImplementation(VoteRedditNode);
    }

    if (hasX) {
      registry.registerImplementation(SharePostXNode);
      registry.registerImplementation(DeletePostXNode);
      registry.registerImplementation(FollowUserXNode);
      registry.registerImplementation(GetPostXNode);
      registry.registerImplementation(GetUserXNode);
      registry.registerImplementation(LikePostXNode);
      registry.registerImplementation(ListFollowersXNode);
      registry.registerImplementation(ListFollowingXNode);
      registry.registerImplementation(ListUserMentionsXNode);
      registry.registerImplementation(ListUserPostsXNode);
      registry.registerImplementation(RepostXNode);
      registry.registerImplementation(SearchPostsXNode);
    }

    if (hasLinkedIn) {
      registry.registerImplementation(SharePostLinkedInNode);
      registry.registerImplementation(GetProfileLinkedInNode);
      registry.registerImplementation(CommentOnPostLinkedInNode);
      registry.registerImplementation(LikePostLinkedInNode);
      registry.registerImplementation(GetPostCommentsLinkedInNode);
      registry.registerImplementation(GetPostLikesLinkedInNode);
    }

    if (hasGitHub) {
      registry.registerImplementation(GetRepositoryGithubNode);
      registry.registerImplementation(GetUserGithubNode);
      registry.registerImplementation(SearchRepositoriesGithubNode);
      registry.registerImplementation(StarRepositoryGithubNode);
      registry.registerImplementation(UnstarRepositoryGithubNode);
      registry.registerImplementation(FollowUserGithubNode);
      registry.registerImplementation(UnfollowUserGithubNode);
      registry.registerImplementation(GetFileContentsGithubNode);
      registry.registerImplementation(CreateUpdateFileGithubNode);
      registry.registerImplementation(DeleteFileGithubNode);
      registry.registerImplementation(ListUserRepositoriesGithubNode);
      registry.registerImplementation(ListOrganizationRepositoriesGithubNode);
    }

    if (hasWordPress) {
      registry.registerImplementation(ListPostsWordPressNode);
      registry.registerImplementation(GetPostWordPressNode);
      registry.registerImplementation(CreatePostWordPressNode);
      registry.registerImplementation(UpdatePostWordPressNode);
      registry.registerImplementation(DeletePostWordPressNode);
      registry.registerImplementation(ListCategoriesWordPressNode);
      registry.registerImplementation(CreateTagWordPressNode);
      registry.registerImplementation(SearchWordPressNode);
      registry.registerImplementation(UploadMediaWordPressNode);
      registry.registerImplementation(GetSiteWordPressNode);
    }

    // Dataset nodes
    registry.registerImplementation(DatasetAiSearchNode);
    registry.registerImplementation(DatasetDeleteFileNode);
    registry.registerImplementation(DatasetDownloadFileNode);
    registry.registerImplementation(DatasetListFilesNode);
    registry.registerImplementation(DatasetSearchNode);
    registry.registerImplementation(DatasetUploadFileNode);

    // 3D Tiles workflow nodes
    registry.registerImplementation(DemToGltfNode);
    registry.registerImplementation(GeoTiffDemQueryNode);
    registry.registerImplementation(GeoTiffMetadataReaderNode);
    registry.registerImplementation(GeoTiffQueryNode);
    registry.registerImplementation(GeoTiffTransformNode);
    registry.registerImplementation(GltfWireframeNode);

    // CSG Primitives
    registry.registerImplementation(CgsCubeNode);
    registry.registerImplementation(CgsSphereNode);
    registry.registerImplementation(CgsCylinderNode);
    registry.registerImplementation(CgsConeNode);
    registry.registerImplementation(CgsTorusNode);

    // CSG Operations
    registry.registerImplementation(CgsUnionNode);
    registry.registerImplementation(CgsDifferenceNode);
    registry.registerImplementation(CgsIntersectionNode);
    registry.registerImplementation(CgsXorNode);

    // CSG Material & Texture
    registry.registerImplementation(CgsApplyMaterialNode);
    registry.registerImplementation(CgsApplyTextureNode);

    // CSG Transformations
    registry.registerImplementation(CgsTranslateNode);
    registry.registerImplementation(CgsRotateNode);
    registry.registerImplementation(CgsScaleNode);

    // Geo nodes
    registry.registerImplementation(AlongNode);
    registry.registerImplementation(AngleNode);
    registry.registerImplementation(AreaNode);
    registry.registerImplementation(BboxClipNode);
    registry.registerImplementation(BboxNode);
    registry.registerImplementation(BboxPolygonNode);
    registry.registerImplementation(BearingNode);
    registry.registerImplementation(BooleanClockwiseNode);
    registry.registerImplementation(BooleanConcaveNode);
    registry.registerImplementation(BooleanContainsNode);
    registry.registerImplementation(BooleanCrossesNode);
    registry.registerImplementation(BooleanDisjointNode);
    registry.registerImplementation(BooleanEqualNode);
    registry.registerImplementation(BooleanIntersectsNode);
    registry.registerImplementation(BooleanOverlapNode);
    registry.registerImplementation(BooleanParallelNode);
    registry.registerImplementation(BooleanPointInPolygonNode);
    registry.registerImplementation(BooleanPointOnLineNode);
    registry.registerImplementation(BooleanTouchesNode);
    registry.registerImplementation(BooleanValidNode);
    registry.registerImplementation(BooleanWithinNode);
    registry.registerImplementation(BufferNode);
    registry.registerImplementation(CenterMeanNode);
    registry.registerImplementation(CenterMedianNode);
    registry.registerImplementation(CenterNode);
    registry.registerImplementation(CenterOfMassNode);
    registry.registerImplementation(CentroidNode);
    registry.registerImplementation(CircleNode);
    registry.registerImplementation(CleanCoordsNode);
    registry.registerImplementation(CombineNode);
    registry.registerImplementation(ConcaveNode);
    registry.registerImplementation(ConvexNode);
    registry.registerImplementation(DestinationNode);
    registry.registerImplementation(DifferenceNode);
    registry.registerImplementation(DistanceNode);
    registry.registerImplementation(EnvelopeNode);
    registry.registerImplementation(ExplodeNode);
    registry.registerImplementation(FeatureCollectionNode);
    registry.registerImplementation(FeatureNode);
    registry.registerImplementation(FlattenNode);
    registry.registerImplementation(FlipNode);
    registry.registerImplementation(GeometryCollectionNode);
    registry.registerImplementation(GeoJsonNode);
    registry.registerImplementation(GeoJsonToSvgNode);
    registry.registerImplementation(GreatCircleNode);
    registry.registerImplementation(IntersectNode);
    registry.registerImplementation(KinksNode);
    registry.registerImplementation(LengthNode);
    registry.registerImplementation(LineArcNode);
    registry.registerImplementation(LineChunkNode);
    registry.registerImplementation(LineIntersectNode);
    registry.registerImplementation(LineOffsetNode);
    registry.registerImplementation(LineOverlapNode);
    registry.registerImplementation(LineSegmentNode);
    registry.registerImplementation(LineSliceAlongNode);
    registry.registerImplementation(LineSliceNode);
    registry.registerImplementation(LineSplitNode);
    registry.registerImplementation(LineStringNode);
    registry.registerImplementation(LineToPolygonNode);
    registry.registerImplementation(MaskNode);
    registry.registerImplementation(MidpointNode);
    registry.registerImplementation(MultiLineStringNode);
    registry.registerImplementation(MultiPointNode);
    registry.registerImplementation(MultiPolygonNode);
    registry.registerImplementation(NearestPointNode);
    registry.registerImplementation(NearestPointOnLineNode);
    registry.registerImplementation(PointNode);
    registry.registerImplementation(PointOnFeatureNode);
    registry.registerImplementation(PointToLineDistanceNode);
    registry.registerImplementation(PointToPolygonDistanceNode);
    registry.registerImplementation(PolygonNode);
    registry.registerImplementation(PolygonSmoothNode);
    registry.registerImplementation(PolygonTangentsNode);
    registry.registerImplementation(PolygonToLineNode);
    registry.registerImplementation(PolygonizeNode);
    registry.registerImplementation(RewindNode);
    registry.registerImplementation(RhumbBearingNode);
    registry.registerImplementation(RhumbDestinationNode);
    registry.registerImplementation(RhumbDistanceNode);
    registry.registerImplementation(RoundNode);
    registry.registerImplementation(SectorNode);
    registry.registerImplementation(ShortestPathNode);
    registry.registerImplementation(SimplifyNode);
    registry.registerImplementation(SquareNode);
    registry.registerImplementation(TransformRotateNode);
    registry.registerImplementation(TransformScaleNode);
    registry.registerImplementation(TransformTranslateNode);
    registry.registerImplementation(TruncateNode);
    registry.registerImplementation(UnionNode);
    registry.registerImplementation(UnkinkPolygonNode);
    registry.registerImplementation(VoronoiNode);
    registry.registerImplementation(WktGeometryNode);

    // OpenAI models - always register (users can provide API keys via secrets)
    registry.registerImplementation(Gpt41Node);
    registry.registerImplementation(Gpt5Node);
    registry.registerImplementation(Gpt5MiniNode);
    registry.registerImplementation(Gpt5NanoNode);

    // Anthropic Claude nodes - always register (users can provide API keys via secrets)
    registry.registerImplementation(ClaudeOpus41Node);
    registry.registerImplementation(ClaudeOpus4Node);
    registry.registerImplementation(ClaudeSonnet4Node);
    registry.registerImplementation(Claude37SonnetNode);
    registry.registerImplementation(Claude35SonnetNode);
    registry.registerImplementation(Claude35HaikuNode);
    registry.registerImplementation(Claude3OpusNode);

    // Google Gemini nodes - always register (users can provide API keys via secrets)
    registry.registerImplementation(Gemini25FlashNode);
    registry.registerImplementation(Gemini25ProNode);
    registry.registerImplementation(Gemini3FlashNode);
    registry.registerImplementation(Gemini31ProNode);
    registry.registerImplementation(Gemini25FlashImagePreviewNode);
    registry.registerImplementation(Gemini31FlashImagePreviewNode);
    registry.registerImplementation(Gemini3ProImagePreviewNode);
    registry.registerImplementation(Gemini25FlashAudioUnderstandingNode);
    registry.registerImplementation(Gemini25ProAudioUnderstandingNode);
    registry.registerImplementation(Gemini25FlashImageUnderstandingNode);
    registry.registerImplementation(Gemini25ProImageUnderstandingNode);
    registry.registerImplementation(Gemini25FlashTtsNode);
    registry.registerImplementation(ImagenNode);

    // Output/Widget nodes - always register (for displaying all parameter types)
    registry.registerImplementation(TextOutputNode);
    registry.registerImplementation(NumberOutputNode);
    registry.registerImplementation(BooleanOutputNode);
    registry.registerImplementation(DateOutputNode);
    registry.registerImplementation(BlobOutputNode);
    registry.registerImplementation(ImageOutputNode);
    registry.registerImplementation(DocumentOutputNode);
    registry.registerImplementation(AudioOutputNode);
    registry.registerImplementation(VideoOutputNode);
    registry.registerImplementation(GltfOutputNode);
    registry.registerImplementation(JsonOutputNode);
    registry.registerImplementation(GeoJSONOutputNode);
    registry.registerImplementation(SecretOutputNode);
    registry.registerImplementation(AnyOutputNode);

    // Agent nodes �?multi-turn agentic execution via Durable Object
    registry.registerImplementation(AgentClaudeSonnet4Node);
    registry.registerImplementation(AgentGemini25FlashNode);
    registry.registerImplementation(AgentGemini3FlashNode);
    registry.registerImplementation(AgentGemini31ProNode);
    registry.registerImplementation(AgentGpt41Node);
    registry.registerImplementation(AgentQwen330BA3BFp8Node);
}
