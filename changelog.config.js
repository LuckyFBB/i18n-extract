module.exports = {
  disableEmoji: false,
  format: "{type}{scope}: {emoji}{subject}",
  list: ["feat", "fix", "refactor", "test", "ci", "docs", "chore", "release"],
  maxMessageLength: 80,
  minMessageLength: 3,
  questions: ["type", "subject", "body", "issues"],
  scopes: ["React", "Node", "Engineering", "DataStructure", "Others", "Base"],
  types: {
    chore: {
      description: "Build process or auxiliary tool changes",
      emoji: "🤖",
      value: "chore",
    },
    ci: {
      description: "CI related changes",
      emoji: "🎡",
      value: "ci",
    },
    docs: {
      description: "Documentation only changes",
      emoji: "📝",
      value: "docs",
    },
    feat: {
      description: "A new feature",
      emoji: "🎸",
      value: "feat",
    },
    fix: {
      description: "A bug fix",
      emoji: "🐛",
      value: "fix",
    },
    refactor: {
      description: "A code change that neither fixes a bug or adds a feature",
      emoji: "💡",
      value: "refactor",
    },
    release: {
      description: "Create a release commit",
      emoji: "🏹",
      value: "release",
    },
    test: {
      description: "Adding missing tests",
      emoji: "💍",
      value: "test",
    },
    messages: {
      type: "Select the type of change that you're committing:",
      customScope: "Select the scope this blog affects:",
      subject: "Write a short, imperative mood description of the change:\n",
      body: "Provide a longer description of the change:\n ",
      breaking: "List any breaking changes:\n",
      footer: "Issues this commit closes, e.g #123:",
      confirmCommit: "The packages that this commit has affected\n",
    },
  },
};
