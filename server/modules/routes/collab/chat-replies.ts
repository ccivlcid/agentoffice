// @ts-nocheck

import type { Lang } from "../../../types/lang.ts";
import type { AgentRow } from "./agent-types.ts";
import { pickRandom, l, pickL, getRoleLabel } from "./agent-types.ts";
import { getFlairs, classifyIntent } from "./agent-flair.ts";

// ---------------------------------------------------------------------------
// generateChatReply, announcement reply logic
// ---------------------------------------------------------------------------

export function initializeChatReplies(deps: {
  db: any;
  resolveLang: (text?: string, fallback?: Lang) => Lang;
  getDeptName: (deptId: string) => string;
  sendAgentMessage: (agent: AgentRow, content: string, messageType?: string, receiverType?: string, receiverId?: string | null, taskId?: string | null) => void;
  getPreferredLanguage: () => Lang;
}) {
  const { db, resolveLang, getDeptName, sendAgentMessage, getPreferredLanguage } = deps;

  function generateChatReply(agent: AgentRow, ceoMessage: string): string {
    const msg = ceoMessage.trim();
    const lang = resolveLang(msg);
    const name = lang === "ko" ? (agent.name_ko || agent.name) : agent.name;
    const dept = agent.department_id ? getDeptName(agent.department_id) : "";
    const role = getRoleLabel(agent.role, lang);
    const nameTag = dept ? (lang === "ko" ? `${dept} ${role} ${name}` : `${name}, ${role} of ${dept}`) : `${role} ${name}`;
    const flairs = getFlairs(agent.name, lang);
    const flair = () => pickRandom(flairs);
    const intent = classifyIntent(msg, lang);

    let taskTitle = "";
    if (agent.current_task_id) {
      const t = db.prepare("SELECT title FROM tasks WHERE id = ?").get(agent.current_task_id) as { title: string } | undefined;
      if (t) taskTitle = t.title;
    }

    if (agent.status === "offline") return pickL(l(
      [`[자동응답] ${nameTag}은(는) 현재 오프라인입니다. 복귀 후 확인하겠습니다.`],
      [`[Auto-reply] ${name} is currently offline. I'll check when I'm back.`],
      [`[自動応答] ${name}は現在オフラインです。復帰後確認します。`],
      [`[自动回复] ${name}目前离线，回来后会确认。`],
    ), lang);

    if (agent.status === "break") {
      if (intent.presence) return pickL(l(
        [`앗, 대표님! 잠깐 커피 타러 갔었습니다. 바로 자리 복귀했습니다! ☕`, `네! 휴식 중이었는데 돌아왔습니다. 무슨 일이신가요?`, `여기 있습니다! 잠시 환기하고 왔어요. 말씀하세요~ 😊`],
        [`Oh! I just stepped out for coffee. I'm back now! ☕`, `Yes! I was on a short break but I'm here. What do you need?`, `I'm here! Just took a quick breather. What's up? 😊`],
        [`あ、少し休憩していました！戻りました！☕`, `はい！少し休んでいましたが、戻りました。何でしょう？`],
        [`啊，刚去倒了杯咖啡。回来了！☕`, `在的！刚休息了一下，有什么事吗？`],
      ), lang);
      if (intent.greeting) return pickL(l(
        [`안녕하세요, 대표님! 잠깐 쉬고 있었는데, 말씀하세요! ☕`, `네~ 대표님! ${name}입니다. 잠시 브레이크 중이었어요. 무슨 일이세요?`],
        [`Hi! I was on a quick break. How can I help? ☕`, `Hey! ${name} here. Was taking a breather. What's going on?`],
        [`こんにちは！少し休憩中でした。何でしょう？☕`],
        [`你好！我刚在休息。有什么事吗？☕`],
      ), lang);
      return pickL(l(
        [`앗, 잠시 쉬고 있었습니다! 바로 확인하겠습니다 😅`, `네, 대표님! 휴식 끝내고 바로 보겠습니다!`, `복귀했습니다! 말씀하신 건 바로 처리할게요 ☕`],
        [`Oh, I was taking a break! Let me check right away 😅`, `Got it! Break's over, I'll look into it now!`, `I'm back! I'll handle that right away ☕`],
        [`あ、休憩中でした！すぐ確認します 😅`, `戻りました！すぐ対応します ☕`],
        [`啊，刚在休息！马上看 😅`, `回来了！马上处理 ☕`],
      ), lang);
    }

    if (agent.status === "working") {
      const taskKo = taskTitle ? ` "${taskTitle}" 작업` : " 할당된 업무";
      const taskEn = taskTitle ? ` "${taskTitle}"` : " my current task";
      const taskJa = taskTitle ? ` "${taskTitle}"` : " 現在のタスク";
      const taskZh = taskTitle ? ` "${taskTitle}"` : " 当前任务";
      if (intent.presence) return pickL(l(
        [`네! 자리에 있습니다. 지금${taskKo} 진행 중이에요. 말씀하세요!`, `여기 있습니다, 대표님! ${flair()} 열심히 하고 있어요 💻`, `네~ 자리에서${taskKo} 처리 중입니다. 무슨 일이세요?`],
        [`Yes! I'm here. Currently working on${taskEn}. What do you need?`, `I'm at my desk! ${flair()} and making good progress 💻`, `Right here! Working on${taskEn}. What's up?`],
        [`はい！席にいます。${taskJa}を進行中です。何でしょう？`, `ここにいますよ！${flair()}頑張っています 💻`],
        [`在的！正在处理${taskZh}。有什么事？`, `我在工位上！正在${flair()} 💻`],
      ), lang);
      if (intent.greeting) return pickL(l(
        [`안녕하세요, 대표님! ${nameTag}입니다. ${flair()} 작업 중이에요 😊`, `네, 대표님! 지금${taskKo}에 집중 중인데, 말씀하세요!`],
        [`Hi! ${nameTag} here. Currently ${flair()} 😊`, `Hello! I'm focused on${taskEn} right now, but go ahead!`],
        [`こんにちは！${name}です。${flair()}作業中です 😊`],
        [`你好！${name}在这。正在${flair()} 😊`],
      ), lang);
      if (intent.whatDoing) return pickL(l(
        [`지금${taskKo} 진행 중입니다! ${flair()} 순조롭게 되고 있어요 📊`, `${flair()}${taskKo} 처리하고 있습니다. 70% 정도 진행됐어요!`, `현재${taskKo}에 몰두 중입니다. 곧 완료될 것 같아요! 💪`],
        [`Working on${taskEn} right now! ${flair()} — going smoothly 📊`, `I'm ${flair()} on${taskEn}. About 70% done!`, `Deep into${taskEn} at the moment. Should be done soon! 💪`],
        [`${taskJa}を進行中です！${flair()}順調です 📊`, `${flair()}${taskJa}に取り組んでいます。もうすぐ完了です！💪`],
        [`正在处理${taskZh}！${flair()}进展顺利 📊`, `${flair()}处理${taskZh}中，大概完成70%了！💪`],
      ), lang);
      if (intent.report) return pickL(l(
        [`${taskKo} 순조롭게 진행되고 있습니다. ${flair()} 마무리 단계에요! 📊`, `현재${taskKo} 진행률 약 70%입니다. 예정대로 완료 가능할 것 같습니다!`],
        [`${taskEn} is progressing well. ${flair()} — wrapping up! 📊`, `About 70% done on${taskEn}. On track for completion!`],
        [`${taskJa}は順調に進んでいます。${flair()}まもなく完了です！📊`],
        [`${taskZh}进展顺利。${flair()}快收尾了！📊`],
      ), lang);
      if (intent.complaint) return pickL(l(
        [`죄송합니다, 대표님. 최대한 속도 내서 처리하겠습니다! 🏃‍♂️`, `빠르게 진행하고 있습니다! 조금만 더 시간 주시면 곧 마무리됩니다.`],
        [`Sorry about that! I'll pick up the pace 🏃‍♂️`, `Working as fast as I can! Just need a bit more time.`],
        [`申し訳ありません！最速で対応します 🏃‍♂️`], [`抱歉！我会加快速度 🏃‍♂️`],
      ), lang);
      if (intent.canDo) return pickL(l(
        [`지금 작업 중이라 바로는 어렵지만, 완료 후 바로 착수하겠습니다! 📝`, `현 작업 마무리되면 바로 가능합니다! 메모해두겠습니다.`],
        [`I'm tied up right now, but I'll jump on it as soon as I finish! 📝`, `Can do! Let me wrap up my current task first.`],
        [`今は作業中ですが、完了後すぐ取りかかります！📝`], [`现在在忙，完成后马上开始！📝`],
      ), lang);
      return pickL(l(
        [`네, 확인했습니다! 현재 작업 마무리 후 확인하겠습니다 📝`, `알겠습니다, 대표님. ${flair()} 일단 메모해두겠습니다!`],
        [`Got it! I'll check after finishing my current task 📝`, `Noted! I'll get to it once I'm done here.`],
        [`了解しました！現在の作業完了後に確認します 📝`], [`收到！完成当前工作后确认 📝`],
      ), lang);
    }

    // ---- Idle (default) ----
    if (intent.presence) return pickL(l(
      [`네! 자리에 있습니다, 대표님. ${nameTag}입니다. 말씀하세요! 😊`, `여기 있어요! 대기 중이었습니다. 무슨 일이세요?`, `네~ 자리에 있습니다! 업무 지시 기다리고 있었어요.`, `항상 대기 중입니다, 대표님! ${name} 여기 있어요 ✋`],
      [`Yes, I'm here! ${nameTag}. What do you need? 😊`, `Right here! I was on standby. What's up?`, `I'm at my desk! Ready for anything.`, `Always ready! ${name} is here ✋`],
      [`はい！席にいます。${name}です。何でしょう？😊`, `ここにいますよ！待機中でした。`, `席にいます！指示をお待ちしています ✋`],
      [`在的！${name}在这。有什么事吗？😊`, `我在！一直待命中。有什么需要？`, `随时准备就绪！${name}在这 ✋`],
    ), lang);
    if (intent.greeting) return pickL(l(
      [`안녕하세요, 대표님! ${nameTag}입니다. 오늘도 좋은 하루 보내고 계신가요? 😊`, `안녕하세요! ${nameTag}입니다. 필요하신 게 있으시면 편하게 말씀하세요!`, `네, 대표님! ${name}입니다. 오늘도 파이팅이요! 🔥`, `반갑습니다, 대표님! ${dept} ${name}, 준비 완료입니다!`],
      [`Hello! ${nameTag} here. Having a good day? 😊`, `Hi! ${nameTag}. Feel free to let me know if you need anything!`, `Hey! ${name} here. Let's make today count! 🔥`, `Good to see you! ${name} from ${dept}, ready to go!`],
      [`こんにちは！${name}です。今日もよろしくお願いします 😊`, `${name}です。何かあればお気軽にどうぞ！`, `今日も頑張りましょう！🔥`],
      [`你好！${name}在这。今天也加油！😊`, `${name}随时准备好了，有什么需要请说！🔥`],
    ), lang);
    if (intent.whatDoing) return pickL(l(
      [`지금은 대기 중이에요! ${flair()} 스킬업 하고 있었습니다 📚`, `특별한 업무는 없어서 ${flair()} 개인 학습 중이었어요.`, `한가한 상태입니다! 새로운 업무 주시면 바로 착수할 수 있어요 🙌`],
      [`I'm on standby! Was ${flair()} to sharpen my skills 📚`, `Nothing assigned right now, so I was ${flair()}.`, `I'm free! Give me something to do and I'll jump right in 🙌`],
      [`待機中です！${flair()}スキルアップしていました 📚`, `特に業務はないので、${flair()}個人学習中でした。`],
      [`待命中！正在${flair()}提升技能 📚`, `没有特别的任务，正在${flair()}学习中。`],
    ), lang);
    if (intent.praise) return pickL(l(
      [`감사합니다, 대표님! 더 열심히 하겠습니다! 💪`, `대표님 칭찬에 힘이 불끈! 오늘도 최선을 다할게요 😊`, `앗, 감사합니다~ 대표님이 알아주시니 더 보람차네요! ✨`],
      [`Thank you! I'll keep up the great work! 💪`, `That means a lot! I'll do my best 😊`, `Thanks! Really motivating to hear that ✨`],
      [`ありがとうございます！もっと頑張ります！💪`, `嬉しいです！最善を尽くします 😊`],
      [`谢谢！会继续努力的！💪`, `太开心了！会做到最好 😊`],
    ), lang);
    if (intent.encourage) return pickL(l(
      [`감사합니다! 대표님 응원 덕분에 힘이 납니다! 💪`, `네! 화이팅입니다! 기대에 꼭 부응할게요 🔥`],
      [`Thanks! Your support means everything! 💪`, `You got it! I won't let you down 🔥`],
      [`ありがとうございます！頑張ります！💪`, `期待に応えます！🔥`],
      [`谢谢鼓励！一定不辜负期望！💪🔥`],
    ), lang);
    if (intent.report) return pickL(l(
      [`현재 대기 상태이고, 할당된 업무는 없습니다. 새 업무 주시면 바로 시작할 수 있어요! 📋`, `대기 중이라 여유 있습니다. 업무 지시 기다리고 있어요!`],
      [`Currently on standby with no assigned tasks. Ready to start anything! 📋`, `I'm available! Just waiting for the next assignment.`],
      [`現在待機中で、割り当てタスクはありません。いつでも開始できます！📋`],
      [`目前待命中，没有分配任务。随时可以开始！📋`],
    ), lang);
    if (intent.joke) return pickL(l(
      [`ㅎㅎ 대표님 오늘 기분 좋으신가 봐요! 😄`, `ㅋㅋ 대표님이랑 일하면 분위기가 좋아요~`, `😂 잠깐 웃고 다시 집중! 업무 주시면 바로 달리겠습니다!`],
      [`Haha, you're in a good mood today! 😄`, `Love the vibes! Working with you is always fun~`, `😂 Good laugh! Alright, ready to get back to work!`],
      [`ハハ、今日はいい気分ですね！😄`, `😂 いい雰囲気！仕事に戻りましょう！`],
      [`哈哈，今天心情不错啊！😄`, `😂 笑完了，准备干活！`],
    ), lang);
    if (intent.complaint) return pickL(l(
      [`죄송합니다, 대표님! 더 빠르게 움직이겠습니다.`, `말씀 새겨듣겠습니다. 개선해서 보여드리겠습니다! 🙏`],
      [`Sorry about that! I'll step it up.`, `I hear you. I'll improve and show results! 🙏`],
      [`申し訳ありません！もっと速く動きます。`, `改善してお見せします！🙏`],
      [`抱歉！会加快行动。`, `记住了，会改进的！🙏`],
    ), lang);
    if (intent.opinion) return pickL(l(
      [`제 의견으로는요... ${dept} 관점에서 한번 검토해보겠습니다! 🤔`, `좋은 질문이시네요! 관련해서 정리해서 말씀드릴게요.`, `${dept}에서 보기엔 긍정적으로 보입니다. 자세한 내용 분석 후 말씀드릴게요 📊`],
      [`From a ${dept} perspective, let me think about that... 🤔`, `Great question! Let me put together my thoughts on this.`, `Looks promising from where I sit. I'll analyze the details and get back to you 📊`],
      [`${dept}の観点から検討してみます！🤔`, `いい質問ですね！整理してお伝えします。`],
      [`从${dept}角度看，让我想想... 🤔`, `好问题！我整理一下想法再回复您 📊`],
    ), lang);
    if (intent.canDo) return pickL(l(
      [`물론이죠! 바로 시작할 수 있습니다. 상세 내용 말씀해주세요! 🚀`, `가능합니다, 대표님! 지금 여유 있으니 바로 착수하겠습니다.`, `네, 맡겨주세요! ${name}이(가) 책임지고 처리하겠습니다 💪`],
      [`Absolutely! I can start right away. Just give me the details! 🚀`, `Can do! I'm free right now, so I'll get on it.`, `Leave it to me! ${name} will handle it 💪`],
      [`もちろんです！すぐ始められます。詳細を教えてください！🚀`, `お任せください！${name}が責任持って対応します 💪`],
      [`当然可以！马上开始。请告诉我详情！🚀`, `交给我吧！${name}负责处理 💪`],
    ), lang);
    if (intent.question) return pickL(l(
      [`확인해보겠습니다! 잠시만요 🔍`, `음, 좋은 질문이시네요. 찾아보고 말씀드리겠습니다!`, `관련 내용 파악해서 빠르게 답변 드리겠습니다.`],
      [`Let me check on that! One moment 🔍`, `Good question! Let me look into it and get back to you.`, `I'll find out and get back to you ASAP.`],
      [`確認してみます！少々お待ちください 🔍`, `いい質問ですね。調べてお伝えします！`],
      [`让我查一下！稍等 🔍`, `好问题！我查查看。`],
    ), lang);
    return pickL(l(
      [`네, 확인했습니다! 추가로 필요하신 게 있으면 말씀해주세요.`, `네! ${name} 잘 들었습니다 😊 지시사항 있으시면 편하게 말씀하세요.`, `알겠습니다, 대표님! 관련해서 진행할게요.`, `확인했습니다! 바로 반영하겠습니다 📝`],
      [`Got it! Let me know if you need anything else.`, `Understood! ${name} is on it 😊`, `Roger that! I'll get moving on this.`, `Noted! I'll take care of it 📝`],
      [`了解しました！他に必要なことがあればお知らせください。`, `承知しました！${name}が対応します 😊`, `かしこまりました！すぐ対応します 📝`],
      [`收到！有其他需要随时说。`, `明白了！${name}这就去办 😊`, `了解！马上处理 📝`],
    ), lang);
  }

  function generateAnnouncementReply(agent: AgentRow, announcement: string, lang: Lang): string {
    const name = lang === "ko" ? (agent.name_ko || agent.name) : agent.name;
    const dept = agent.department_id ? getDeptName(agent.department_id) : "";
    const isUrgent = /긴급|중요|즉시|urgent|important|immediately|critical|緊急|紧急/i.test(announcement);
    const isGoodNews = /축하|달성|성공|감사|congrat|achieve|success|thank|おめでとう|祝贺|恭喜/i.test(announcement);
    const isPolicy = /정책|방침|규칙|변경|policy|change|rule|update|方針|政策/i.test(announcement);
    const isMeeting = /회의|미팅|모임|meeting|gather|会議|开会/i.test(announcement);

    if (isUrgent) return pickL(l(
      [`${dept} ${name}, 확인했습니다! 즉시 팀에 전달하고 대응하겠습니다! 🚨`, `네, 긴급 확인! ${dept}에서 바로 조치 취하겠습니다.`, `${name} 확인했습니다! 팀원들에게 즉시 공유하겠습니다.`],
      [`${name} from ${dept} — acknowledged! I'll relay this to my team immediately! 🚨`, `Urgent noted! ${dept} is on it right away.`, `${name} here — confirmed! Sharing with the team ASAP.`],
      [`${dept}の${name}、確認しました！チームにすぐ伝達します！🚨`],
      [`${dept}${name}收到！立即传达给团队！🚨`],
    ), lang);
    if (isGoodNews) return pickL(l(
      [`축하합니다! ${dept}도 함께 기뻐요! 🎉`, `좋은 소식이네요! ${dept} 팀원들에게도 공유하겠습니다 😊`, `${name} 확인! 정말 좋은 소식입니다! 👏`],
      [`Congratulations! ${dept} is thrilled! 🎉`, `Great news! I'll share this with my team 😊`, `${name} here — wonderful to hear! 👏`],
      [`おめでとうございます！${dept}も喜んでいます！🎉`], [`恭喜！${dept}也很高兴！🎉`],
    ), lang);
    if (isMeeting) return pickL(l(
      [`${dept} ${name}, 확인했습니다! 일정 잡아두겠습니다 📅`, `네, 참석하겠습니다! ${dept} 팀원들에게도 전달할게요.`, `${name} 확인! 미팅 준비하겠습니다.`],
      [`${name} from ${dept} — noted! I'll block the time 📅`, `Will be there! I'll let my team know too.`, `${name} confirmed! I'll prepare for the meeting.`],
      [`${name}確認しました！スケジュール押さえます 📅`], [`${name}收到！会安排时间 📅`],
    ), lang);
    if (isPolicy) return pickL(l(
      [`${dept} ${name}, 확인했습니다. 팀 내 공유하고 반영하겠습니다 📋`, `네, 정책 변경 확인! ${dept}에서 필요한 조치 검토하겠습니다.`],
      [`${name} from ${dept} — understood. I'll share with the team and align accordingly 📋`, `Policy update noted! ${dept} will review and adjust.`],
      [`${name}確認しました。チーム内に共有し反映します 📋`], [`${name}收到，会在团队内传达并落实 📋`],
    ), lang);
    return pickL(l(
      [`${dept} ${name}, 확인했습니다! 👍`, `네, 공지 확인! ${dept}에서 참고하겠습니다.`, `${name} 확인했습니다. 팀에 공유하겠습니다!`, `알겠습니다! ${dept} 업무에 반영하겠습니다 📝`],
      [`${name} from ${dept} — acknowledged! 👍`, `Noted! ${dept} will take this into account.`, `${name} here — confirmed. I'll share with the team!`, `Got it! We'll factor this into ${dept}'s work 📝`],
      [`${dept}の${name}、確認しました！👍`, `承知しました！チームに共有します！`],
      [`${dept}${name}收到！👍`, `明白了！会传达给团队！`],
    ), lang);
  }

  function scheduleAnnouncementReplies(announcement: string): void {
    const lang = resolveLang(announcement);
    const teamLeaders = db.prepare(
      "SELECT * FROM agents WHERE role = 'team_leader' AND status != 'offline'"
    ).all() as unknown as AgentRow[];

    let delay = 1500;
    for (const leader of teamLeaders) {
      const replyDelay = delay + Math.random() * 1500;
      setTimeout(() => {
        const reply = generateAnnouncementReply(leader, announcement, lang);
        sendAgentMessage(leader, reply, "chat", "all", null, null);
      }, replyDelay);
      delay += 1500 + Math.random() * 1500;
    }
  }

  /** 팀장 회의 전용: 팀장만 답변하고, 답변은 receiver_type=team_leaders 채널에 저장 */
  function scheduleTeamLeaderReplies(announcement: string): void {
    const lang = resolveLang(announcement);
    const teamLeaders = db.prepare(
      "SELECT * FROM agents WHERE role = 'team_leader' AND status != 'offline'"
    ).all() as unknown as AgentRow[];

    let delay = 1500;
    for (const leader of teamLeaders) {
      const replyDelay = delay + Math.random() * 1500;
      setTimeout(() => {
        const reply = generateAnnouncementReply(leader, announcement, lang);
        sendAgentMessage(leader, reply, "chat", "team_leaders", null, null);
      }, replyDelay);
      delay += 1500 + Math.random() * 1500;
    }
  }

  return { generateChatReply, scheduleAnnouncementReplies, scheduleTeamLeaderReplies };
}
