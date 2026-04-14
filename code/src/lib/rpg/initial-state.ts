// RPG 游戏初始状态
import type { RpgUpdateType } from './types';

export function createInitialState(): RpgUpdateType {
  return {
    scene: '你站在一片幽暗森林的入口。古树参天，枝叶交错遮蔽了大部分天光。一条蜿蜒的小径通向森林深处，远处隐约传来流水声。空气中弥漫着潮湿的泥土气息，似乎有什么东西在暗处窥视着你。',
    playerHp: 100,
    playerMaxHp: 100,
    inventory: ['一把生锈的短剑', '一盏油灯', '三天的干粮'],
    eventLog: ['冒险开始：踏入幽暗森林'],
    gameOver: false,
    victory: false,
    currentAction: null,
    npcMemory: [],
  };
}
