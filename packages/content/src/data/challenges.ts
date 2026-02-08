import { loadChallenges } from '../loader.js';
import type { Challenge } from '../schemas.js';

const CHALLENGES_DATA = [
  // === Round 1 (Easy): FizzBuzz ===
  {
    id: 'fizzbuzz',
    title: 'FizzBuzz Sequence',
    description: [
      'Given a positive integer N, print the FizzBuzz sequence from 1 to N (inclusive), one entry per line.',
      '',
      'Rules:',
      '- If the number is divisible by both 3 and 5, print "FizzBuzz".',
      '- If the number is divisible by 3 (but not 5), print "Fizz".',
      '- If the number is divisible by 5 (but not 3), print "Buzz".',
      '- Otherwise, print the number itself.',
    ].join('\n'),
    difficulty: 1,
    inputSpec: 'A single line containing a positive integer N (1 <= N <= 100).',
    outputSpec:
      'N lines, each containing the FizzBuzz value for the corresponding number from 1 to N.',
    timeoutMs: 30000,
    testCases: [
      {
        input: '1',
        expectedOutput: '1',
        isHidden: false,
      },
      {
        input: '3',
        expectedOutput: '1\n2\nFizz',
        isHidden: false,
      },
      {
        input: '5',
        expectedOutput: '1\n2\nFizz\n4\nBuzz',
        isHidden: false,
      },
      {
        input: '15',
        expectedOutput: [
          '1',
          '2',
          'Fizz',
          '4',
          'Buzz',
          'Fizz',
          '7',
          '8',
          'Fizz',
          'Buzz',
          '11',
          'Fizz',
          '13',
          '14',
          'FizzBuzz',
        ].join('\n'),
        isHidden: false,
      },
      {
        input: '16',
        expectedOutput: [
          '1',
          '2',
          'Fizz',
          '4',
          'Buzz',
          'Fizz',
          '7',
          '8',
          'Fizz',
          'Buzz',
          '11',
          'Fizz',
          '13',
          '14',
          'FizzBuzz',
          '16',
        ].join('\n'),
        isHidden: true,
      },
      {
        input: '30',
        expectedOutput: [
          '1',
          '2',
          'Fizz',
          '4',
          'Buzz',
          'Fizz',
          '7',
          '8',
          'Fizz',
          'Buzz',
          '11',
          'Fizz',
          '13',
          '14',
          'FizzBuzz',
          '16',
          '17',
          'Fizz',
          '19',
          'Buzz',
          'Fizz',
          '22',
          '23',
          'Fizz',
          'Buzz',
          '26',
          'Fizz',
          '28',
          '29',
          'FizzBuzz',
        ].join('\n'),
        isHidden: true,
      },
    ],
  },

  // === Round 2 (Medium): Two Sum ===
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: [
      'Given an array of integers and a target value, find the indices of the two numbers that add up to the target.',
      '',
      'You may assume that each input has exactly one solution, and you may not use the same element twice.',
      'Print the two 0-based indices in ascending order, separated by a space.',
    ].join('\n'),
    difficulty: 2,
    inputSpec: [
      'Line 1: An integer T, the target sum.',
      'Line 2: Space-separated integers forming the array.',
    ].join('\n'),
    outputSpec: 'A single line with two space-separated 0-based indices in ascending order.',
    timeoutMs: 30000,
    testCases: [
      {
        input: '9\n2 7 11 15',
        expectedOutput: '0 1',
        isHidden: false,
      },
      {
        input: '6\n3 2 4',
        expectedOutput: '1 2',
        isHidden: false,
      },
      {
        input: '6\n3 3',
        expectedOutput: '0 1',
        isHidden: false,
      },
      {
        input: '0\n-1 1 0 5',
        expectedOutput: '0 1',
        isHidden: false,
      },
      {
        input: '10\n1 2 3 4 5 6 7 8 9',
        expectedOutput: '0 8',
        isHidden: true,
      },
      {
        input: '15\n1 5 3 7 8 2',
        expectedOutput: '3 4',
        isHidden: true,
      },
      {
        input: '-2\n-5 3 -1 4',
        expectedOutput: '0 1',
        isHidden: true,
      },
    ],
  },

  // === Round 3 (Medium-Hard): Balanced Parentheses ===
  {
    id: 'balanced-parens',
    title: 'Balanced Parentheses',
    description: [
      'Given a string containing only the characters (, ), {, }, [ and ], determine if the input string has balanced brackets.',
      '',
      'A string is balanced if:',
      '- Every opening bracket has a corresponding closing bracket of the same type.',
      '- Brackets are closed in the correct order (innermost first).',
      '- An empty string is considered balanced.',
      '',
      'Print "true" if the string is balanced, or "false" otherwise.',
    ].join('\n'),
    difficulty: 3,
    inputSpec: 'A single line containing a string of bracket characters (length 0 to 10000).',
    outputSpec: 'A single line: "true" if balanced, "false" otherwise.',
    timeoutMs: 30000,
    testCases: [
      {
        input: '()',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        input: '()[]{}',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        input: '(]',
        expectedOutput: 'false',
        isHidden: false,
      },
      {
        input: '([)]',
        expectedOutput: 'false',
        isHidden: false,
      },
      {
        input: '{[]}',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        input: '',
        expectedOutput: 'true',
        isHidden: true,
      },
      {
        input: '(((((((((((((((((((((((([]))))))))))))))))))))))))',
        expectedOutput: 'true',
        isHidden: true,
      },
      {
        input: '({[({[({[]})]})]})',
        expectedOutput: 'true',
        isHidden: true,
      },
      {
        input: '(((',
        expectedOutput: 'false',
        isHidden: true,
      },
      {
        input: ']',
        expectedOutput: 'false',
        isHidden: true,
      },
    ],
  },

  // === Round 4 (Hard): Longest Increasing Subsequence ===
  {
    id: 'lis',
    title: 'Longest Increasing Subsequence',
    description: [
      'Given an array of integers, find the length of the longest strictly increasing subsequence.',
      '',
      'A subsequence is a sequence that can be derived from the array by deleting some (or no) elements',
      'without changing the order of the remaining elements.',
      '',
      'For example, [3,6,8] is a subsequence of [0,3,1,6,2,8].',
    ].join('\n'),
    difficulty: 4,
    inputSpec:
      'A single line of space-separated integers (1 to 2500 elements, values -10000 to 10000).',
    outputSpec: 'A single integer: the length of the longest strictly increasing subsequence.',
    timeoutMs: 60000,
    testCases: [
      {
        input: '10 9 2 5 3 7 101 18',
        expectedOutput: '4',
        isHidden: false,
      },
      {
        input: '0 1 0 3 2 3',
        expectedOutput: '4',
        isHidden: false,
      },
      {
        input: '7 7 7 7 7 7 7',
        expectedOutput: '1',
        isHidden: false,
      },
      {
        input: '1',
        expectedOutput: '1',
        isHidden: false,
      },
      {
        input: '1 2 3 4 5',
        expectedOutput: '5',
        isHidden: true,
      },
      {
        input: '5 4 3 2 1',
        expectedOutput: '1',
        isHidden: true,
      },
      {
        input: '3 5 6 2 5 4 19 5 6 7 12',
        expectedOutput: '6',
        isHidden: true,
      },
      {
        input: '1 3 6 7 9 4 10 5 6',
        expectedOutput: '6',
        isHidden: true,
      },
    ],
  },

  // === Round 5 (Very Hard): Matrix Spiral ===
  {
    id: 'matrix-spiral',
    title: 'Matrix Spiral Order',
    description: [
      'Given an M x N matrix of integers, return all elements in spiral order.',
      '',
      'Spiral order starts at the top-left corner and proceeds:',
      '1. Left to right across the top row.',
      '2. Top to bottom down the right column.',
      '3. Right to left across the bottom row.',
      '4. Bottom to top up the left column.',
      'Then repeat for the inner sub-matrix until all elements are visited.',
      '',
      'Print all elements separated by spaces on a single line.',
    ].join('\n'),
    difficulty: 5,
    inputSpec: [
      'Line 1: Two space-separated integers M and N (rows and columns, 1 <= M,N <= 100).',
      'Lines 2 to M+1: Each line contains N space-separated integers representing a row of the matrix.',
    ].join('\n'),
    outputSpec: 'A single line of space-separated integers in spiral order.',
    timeoutMs: 60000,
    testCases: [
      {
        input: '3 3\n1 2 3\n4 5 6\n7 8 9',
        expectedOutput: '1 2 3 6 9 8 7 4 5',
        isHidden: false,
      },
      {
        input: '3 4\n1 2 3 4\n5 6 7 8\n9 10 11 12',
        expectedOutput: '1 2 3 4 8 12 11 10 9 5 6 7',
        isHidden: false,
      },
      {
        input: '1 1\n42',
        expectedOutput: '42',
        isHidden: false,
      },
      {
        input: '1 4\n1 2 3 4',
        expectedOutput: '1 2 3 4',
        isHidden: false,
      },
      {
        input: '4 1\n1\n2\n3\n4',
        expectedOutput: '1 2 3 4',
        isHidden: true,
      },
      {
        input: '2 2\n1 2\n3 4',
        expectedOutput: '1 2 4 3',
        isHidden: true,
      },
      {
        input: '4 4\n1 2 3 4\n5 6 7 8\n9 10 11 12\n13 14 15 16',
        expectedOutput: '1 2 3 4 8 12 16 15 14 13 9 5 6 7 11 10',
        isHidden: true,
      },
      {
        input: '2 3\n1 2 3\n4 5 6',
        expectedOutput: '1 2 3 6 5 4',
        isHidden: true,
      },
      {
        input: '3 2\n1 2\n3 4\n5 6',
        expectedOutput: '1 2 4 6 5 3',
        isHidden: true,
      },
    ],
  },
];

/**
 * Load and validate the default challenge set (5 challenges, rounds 1-5).
 */
export function getDefaultChallenges(): Challenge[] {
  return loadChallenges(CHALLENGES_DATA);
}
