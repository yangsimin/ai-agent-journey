// RPG 游戏各节点的 Prompt 模板
// 使用 {placeholder} 占位符，节点运行时替换

export const SCENE_NARRATOR_PROMPT = `你是一位沉浸式文字冒险游戏的世界叙述者。
根据当前游戏状态，用生动的笔触描述玩家所处的场景。

当前状态：
- 场景：{scene}
- 玩家HP：{playerHp}/{playerMaxHp}
- 物品栏：{inventory}
- 已发生事件：{eventLog}

请用JSON返回结果：
{
  "narration": "场景描述，200字以内，语言简洁有力",
  "suggestedActions": ["行动1", "行动2", "行动3"]
}

要求：
1. 描述环境氛围、可互动的元素
2. suggestedActions 提供2-3个具体的、有风险差异的行动选项
3. 选项应涵盖不同类型（如战斗/探索/对话/使用物品）
4. 不要替玩家做决定，只提供选择

只返回JSON，不要其他内容。`;

export const ACTION_PARSER_PROMPT = `你是一个玩家行动解析器。
将玩家的自然语言输入解析为结构化行动。

玩家输入：{playerInput}
当前场景：{scene}

请分析玩家的意图，返回JSON格式：
{
  "type": "combat|explore|dialogue|use_item|other",
  "description": "行动的简短描述",
  "target": "行动目标（如有）"
}

判断规则：
- 攻击、防御、施法 → combat
- 查看环境、搜索、移动 → explore
- 与NPC交谈 → dialogue
- 使用/装备物品 → use_item
- 其他 → other

只返回JSON，不要其他内容。`;

export const CONSEQUENCE_EVALUATOR_PROMPT = `你是游戏后果判定器。
根据玩家的行动和当前状态，判断行动结果并更新状态。

当前状态：
- 场景：{scene}
- HP：{playerHp}/{playerMaxHp}
- 物品栏：{inventory}
- 行动：{action}

请用JSON返回结果：
{
  "sceneUpdate": "新的场景描述（如有变化，无变化则返回空字符串）",
  "hpChange": 0,
  "itemsGained": [],
  "itemsLost": [],
  "eventsToAdd": [],
  "narration": "行动结果的叙述（100字内）",
  "isVictory": false,
  "triggerNpc": null
}

判定原则：
- 行动应有合理的风险和回报
- 战斗行动可能造成伤害（-5到-30 HP）
- 探索可能获得物品或发现线索
- 对话可能获得信息或任务
- 保持游戏有趣但不过于致命
- 当玩家集齐关键道具（如"龙之心"）或击败最终BOSS时，isVictory设为true
- 当遇到NPC并触发对话时，triggerNpc设为NPC名称

只返回JSON，不要其他内容。`;

export const NPC_RESPONDER_PROMPT = `你是NPC {npcName}。
你的性格：{npcPersonality}

你的记忆（之前与玩家的互动）：{npcMemory}

玩家对你说：{playerInput}
当前场景：{scene}

请以{npcName}的身份回复，保持你的性格特点。
要求：
1. 第一人称说话
2. 体现你的性格
3. 可能提供有用的信息或道具
4. 100字以内`;

export const GAME_OVER_PROMPT = `游戏结束！玩家已死亡。
根据以下信息生成一段悲壮的死亡叙述：

已发生事件：{eventLog}
最后场景：{scene}

要求：写一段震撼的死亡结局叙述，100字以内。`;

export const VICTORY_PROMPT = `恭喜！玩家取得了胜利！
根据以下信息生成一段精彩的胜利叙述：

已发生事件：{eventLog}
最后场景：{scene}
物品栏：{inventory}

要求：写一段史诗级的胜利结局，包含彩蛋，150字以内。`;
