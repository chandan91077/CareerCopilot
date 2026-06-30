import { CodingQuestion } from './types';

export const SAMPLE_CODING_QUESTIONS: CodingQuestion[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
    difficulty: 'Easy',
    category: 'Arrays',
    starterTemplates: {
      javascript: `function twoSum(nums, target) {\n  // Write your code here\n  return [];\n}`,
      python: `def twoSum(nums: list[int], target: int) -> list[int]:\n    # Write your code here\n    return []`,
      java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[0];\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your code here\n        return {};\n    }\n};`
    },
    testCases: [
      { input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false },
      { input: '[3,2,4], 6', expectedOutput: '[1,2]', isHidden: false },
      { input: '[3,3], 6', expectedOutput: '[0,1]', isHidden: true }
    ]
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    description: 'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
    difficulty: 'Easy',
    category: 'Stacks',
    starterTemplates: {
      javascript: `function isValid(s) {\n  // Write your code here\n  return false;\n}`,
      python: `def isValid(s: str) -> bool:\n    # Write your code here\n    return False`,
      java: `class Solution {\n    public boolean isValid(String s) {\n        // Write your code here\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isValid(string s) {\n        // Write your code here\n        return false;\n    }\n};`
    },
    testCases: [
      { input: '"()"', expectedOutput: 'true', isHidden: false },
      { input: '"()[]{}"', expectedOutput: 'true', isHidden: false },
      { input: '"(]"', expectedOutput: 'false', isHidden: true }
    ]
  },
  {
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    description: 'Given the head of a singly linked list, reverse the list, and return its reversed list.',
    difficulty: 'Easy',
    category: 'Linked Lists',
    starterTemplates: {
      javascript: `/*\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\nfunction reverseList(head) {\n  // Write your code here\n  return head;\n}`,
      python: `# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\ndef reverseList(head):\n    # Write your code here\n    return head`,
      java: `/**\n * public class ListNode {\n *     int val;\n *     ListNode next;\n *     ListNode() {}\n *     ListNode(int val) { this.val = val; }\n *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n * }\n */\nclass Solution {\n    public ListNode reverseList(ListNode head) {\n        // Write your code here\n        return head;\n    }\n}`,
      cpp: `/**\n * struct ListNode {\n *     int val;\n *     ListNode *next;\n *     ListNode() : val(0), next(nullptr) {}\n *     ListNode(x) : val(x), next(nullptr) {}\n *     ListNode(x, ListNode *next) : val(x), next(next) {}\n * };\n */\nclass Solution {\npublic:\n    ListNode* reverseList(ListNode* head) {\n        // Write your code here\n        return head;\n    }\n};`
    },
    testCases: [
      { input: '[1,2,3,4,5]', expectedOutput: '[5,4,3,2,1]', isHidden: false },
      { input: '[1,2]', expectedOutput: '[2,1]', isHidden: false },
      { input: '[]', expectedOutput: '[]', isHidden: true }
    ]
  },
  {
    id: 'lru-cache',
    title: 'LRU Cache',
    description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the `LRUCache` class:\n- `LRUCache(int capacity)` Initialize the LRU cache with positive size `capacity`.\n- `int get(int key)` Return the value of the `key` if the key exists, otherwise return `-1`.\n- `void put(int key, int value)` Update the value of the `key` if the `key` exists. Otherwise, add the `key-value` pair to the cache. If the number of keys exceeds the `capacity` from this operation, evict the least recently used key.\n\nThe functions `get` and `put` must each run in `O(1)` average time complexity.',
    difficulty: 'Medium',
    category: 'Design',
    starterTemplates: {
      javascript: `class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n  }\n  get(key) {\n    return -1;\n  }\n  put(key, value) {\n  }\n}`,
      python: `class LRUCache:\n    def __init__(self, capacity: int):\n        self.capacity = capacity\n    def get(self, key: int) -> int:\n        return -1\n    def put(self, key: int, value: int) -> None:\n        pass`,
      java: `class LRUCache {\n    public LRUCache(int capacity) {\n    }\n    public int get(int key) {\n        return -1;\n    }\n    public void put(int key, int value) {\n    }\n}`,
      cpp: `class LRUCache {\npublic:\n    LRUCache(int capacity) {\n    }\n    int get(int key) {\n        return -1;\n    }\n    void put(int key, int value) {\n    }\n};`
    },
    testCases: [
      { input: '["LRUCache","put","put","get","put","get","put","get","get","get"], [[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]', expectedOutput: '[null,null,null,1,null,-1,null,-1,3,4]', isHidden: false }
    ]
  }
];

export const MOCK_INTERVIEW_TOPICS = {
  'Software Engineer': [
    'Explain the differences between REST and GraphQL.',
    'What is your experience with system scaling and handling high traffic workloads?',
    'How do you design secure and stateless session authentication?'
  ],
  'Frontend': [
    'What are the core performance differences between rendering strategies: SSR, SSG, and CSR?',
    'How does React Fiber architecture work under the hood, and how does it relate to concurrent rendering?',
    'Explain modern state management options and how you optimize long lists in DOM grids.'
  ],
  'Backend': [
    'Compare Relational DBs vs NoSQL DBs regarding ACID transactions and scalability.',
    'Describe the Event Loop in Node.js and how it handles asynchronous execution threads.',
    'How would you address a database deadlock issue under high write loads?'
  ],
  'AI Engineer / Machine Learning': [
    'What is the difference between supervised, unsupervised, and reinforcement learning?',
    'How do transformer-based LLMs process sequences using attention mechanisms?',
    'What strategies do you use to mitigate hallucination and limit prompt injection in LLM pipelines?'
  ],
  'HR / Behavioral': [
    'Describe a situation where you had a conflict with a team member and how you resolved it.',
    'Tell me about a time when you failed to meet a deadline. What did you learn?',
    'Explain how you balance technical debt against the business demand for rapid feature releases.'
  ]
};
