# ChatGPT Prompt Engineering for Developers

## Guidelines

### Principle 1: Write clear and specific instructions

Tactic 1: Use delimiters
```
将内容限定在指定的符号内，这样能方便 LLM 识别，也可以防治 prompt 注入攻击
```

Tactic 2: Ask for structured output
```
引导 LLM 以 JSON 或者 HTML 等格式输出
```

Tactic 4: Few-shot prompting
```
提供例子供 LLM 参考，这样它可以更准确知道我们的意图
```

### Principle 2: Give the model time to “think”

Tactic 1: Specify the steps required to complete a task
