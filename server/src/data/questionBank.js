// =============================================================
// data/questionBank.js — BUILT-IN LEVEL-TEST QUESTIONS (free forever)
// -------------------------------------------------------------
// Written once by hand. When a student's subject matches one of these
// topics, the level test comes from here instead of the AI.
// Format: [question, [4 options], index of the correct option]
// Options are shuffled every time they're served.
// Want to add a topic? Add a block here + keywords in library.js.
// =============================================================
export const BUILTIN_QUESTIONS = {
  dsa: {
    easy: [
      ["Time complexity of binary search on a sorted array of n elements?", ["O(n)", "O(log n)", "O(n log n)", "O(1)"], 1],
      ["Which data structure follows LIFO (last in, first out)?", ["Queue", "Stack", "Linked list", "Heap"], 1],
      ["Accessing the i-th element of an array takes:", ["O(1)", "O(log n)", "O(n)", "O(n²)"], 0],
    ],
    medium: [
      ["Worst-case time complexity of quicksort?", ["O(n log n)", "O(n)", "O(n²)", "O(log n)"], 2],
      ["Which traversal of a binary search tree visits keys in sorted order?", ["Preorder", "Inorder", "Postorder", "Level order"], 1],
      ["Average time to look up a key in a hash map:", ["O(1)", "O(log n)", "O(n)", "O(n log n)"], 0],
    ],
    hard: [
      ["Which algorithm finds shortest paths from one source when all edge weights are non-negative?", ["Depth-first search", "Dijkstra's algorithm", "Kruskal's algorithm", "Topological sort"], 1],
      ["Computing the nth Fibonacci number with memoization takes:", ["O(2ⁿ)", "O(n)", "O(n²)", "O(log n)"], 1],
    ],
  },
  javascript: {
    easy: [
      ["Which keyword declares a variable that cannot be reassigned?", ["var", "let", "const", "static"], 2],
      ["What does typeof null return?", ['"null"', '"object"', '"undefined"', '"number"'], 1],
      ["Which array method adds an element to the end?", ["push()", "pop()", "shift()", "unshift()"], 0],
    ],
    medium: [
      ["What does 0.1 + 0.2 === 0.3 evaluate to?", ["true", "false", "TypeError", "undefined"], 1],
      ["What does [1, 2, 3].map(x => x * 2) return?", ["[2, 4, 6]", "[1, 2, 3]", "12", "undefined"], 0],
      ["What's the difference between == and ===?", ["=== also compares types, without converting", "== is faster", "They are identical", "=== only works on numbers"], 0],
    ],
    hard: [
      ["Order printed: console.log(1); setTimeout(() => console.log(2), 0); Promise.resolve().then(() => console.log(3)); console.log(4);", ["1 2 3 4", "1 4 3 2", "1 4 2 3", "1 3 4 2"], 1],
      ["What does a closure let a function do?", ["Use variables from the scope it was created in, even after that scope finished", "Run on multiple threads", "Stop garbage collection", "Close the browser tab"], 0],
    ],
  },
  python: {
    easy: [
      ["What does print(len([1, 2, 3])) print?", ["2", "3", "4", "Error"], 1],
      ["Which of these types is immutable?", ["list", "dict", "tuple", "set"], 2],
      ["What does 10 // 3 evaluate to?", ["3.33", "3", "4", "1"], 1],
    ],
    medium: [
      ["What does [x * x for x in range(3)] give?", ["[0, 1, 4]", "[1, 4, 9]", "[0, 1, 2]", "[1, 2, 3]"], 0],
      ["Which keyword turns a function into a generator?", ["return", "yield", "async", "lambda"], 1],
      ["How do you read key \"a\" from dict d without an error if it's missing?", ['d["a"]', 'd.get("a")', "d.a", 'd->a'], 1],
    ],
    hard: [
      ["def f(x=[]): x.append(1); return len(x). After calling f() once, what does print(f()) show?", ["1", "2", "0", "Error"], 1],
      ["Average time complexity of `x in s` when s is a set?", ["O(n)", "O(1)", "O(log n)", "O(n²)"], 1],
    ],
  },
  sql: {
    easy: [
      ["Which clause filters rows?", ["ORDER BY", "WHERE", "GROUP BY", "SELECT"], 1],
      ["Which statement adds a new row?", ["UPDATE", "INSERT", "ALTER", "ADD"], 1],
      ["What does COUNT(*) return?", ["Number of rows", "Sum of a column", "Number of columns", "Largest value"], 0],
    ],
    medium: [
      ["Which clause filters groups after GROUP BY?", ["WHERE", "HAVING", "LIMIT", "ON"], 1],
      ["An INNER JOIN returns:", ["Only rows that match in both tables", "All rows from the left table", "All rows from both tables", "Only rows with no match"], 0],
      ["A primary key must be:", ["Unique and not NULL", "Always a number", "Indexed text", "The same as a foreign key"], 0],
    ],
    hard: [
      ["In a LEFT JOIN, when the right table has no match, its columns contain:", ["0", "An empty string", "NULL", "The left table's values"], 2],
      ["Which is true about indexes?", ["They speed up reads but can slow down writes", "They only speed up writes", "Every column needs one", "They store a duplicate table"], 0],
    ],
  },
  react: {
    easy: [
      ["What does JSX compile into?", ["Function calls that create elements", "HTML files", "CSS", "SQL"], 0],
      ["Which hook stores state in a function component?", ["useEffect", "useState", "useRef", "useMemo"], 1],
      ["Props are:", ["Inputs passed from a parent component", "Global variables", "CSS classes", "Database rows"], 0],
    ],
    medium: [
      ["Why do list items need a key?", ["So React can tell which items changed", "For styling", "For SEO", "To make them clickable"], 0],
      ["When does useEffect(fn, []) run fn?", ["After the first render (mount) only", "Before every render", "After every render", "Never"], 0],
      ["Correct way to update state based on its previous value?", ["setCount(c => c + 1)", "count++", "this.count = count + 1", "setCount(count++)"], 0],
    ],
    hard: [
      ["You push() into a state array and call setItems(items) with the same array. What happens?", ["React may skip the re-render because the reference didn't change", "It always re-renders", "It throws an error", "The array is deleted"], 0],
      ["What does useMemo do?", ["Caches a computed value until its dependencies change", "Stores state permanently", "Fetches data", "Creates a ref"], 0],
    ],
  },
  java: {
    easy: [
      ["Which is the entry-point method of a Java program?", ["public static void main(String[] args)", "void start()", "public main()", "static int run(String s)"], 0],
      ["Which of these is NOT a primitive type?", ["int", "boolean", "String", "char"], 2],
      ["Which keyword makes a class inherit from another class?", ["implements", "extends", "inherits", "super"], 1],
    ],
    medium: [
      ["For Strings, what's the difference between == and .equals()?", ["== compares references, equals() compares content", "They are the same", "equals() compares references", "== compares length"], 0],
      ["Which collection does not allow duplicates?", ["ArrayList", "HashSet", "LinkedList", "ArrayDeque"], 1],
      ["What is method overloading?", ["Same method name, different parameters, in the same class", "A subclass redefining a method", "Calling a method twice", "A method with no body"], 0],
    ],
    hard: [
      ["A checked exception is neither caught nor declared with throws. Result?", ["Compile-time error", "Only a runtime crash", "It's ignored", "The JVM retries"], 0],
      ["Average time complexity of HashMap.get()?", ["O(1)", "O(n)", "O(log n)", "O(n²)"], 0],
    ],
  },
  aptitude: {
    easy: [
      ["What is 20% of 150?", ["20", "30", "35", "15"], 1],
      ["Next number: 2, 6, 12, 20, 30, ?", ["40", "42", "44", "36"], 1],
      ["A car covers 120 km in 2 hours. Its speed?", ["50 km/h", "60 km/h", "70 km/h", "240 km/h"], 1],
    ],
    medium: [
      ["A finishes a job in 10 days, B in 15 days. Working together?", ["5 days", "6 days", "8 days", "12.5 days"], 1],
      ["A price rises 10%, then falls 10%. Net change?", ["No change", "1% decrease", "1% increase", "10% decrease"], 1],
      ["Average of 10, 20, 30 and 40?", ["20", "25", "30", "100"], 1],
    ],
    hard: [
      ["How many ways can the letters of \"CAT\" be arranged?", ["3", "6", "9", "27"], 1],
      ["Probability of at least one head in 2 fair coin tosses?", ["1/4", "1/2", "3/4", "1"], 2],
    ],
  },
};
