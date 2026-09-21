from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import httpx
import json
import random
from sqlmodel import Session, select
from app.database import get_session
from app.models import Skill

router = APIRouter()

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
MODEL_NAME = "llama3.1"

class GenerateQuestionsRequest(BaseModel):
    skill_name: str = Field(..., description="e.g. 'Python', 'SQL'")
    num_questions: int = Field(default=5, ge=1, le=15)
    difficulty: str = Field(default="Medium", description="Easy, Medium, Hard")
    topics: Optional[List[str]] = Field(default=None, description="Optional subtopics")

class GeneratedQuestion(BaseModel):
    question_text: str
    reference_answer: str
    rubric: str

class GenerateQuestionsResponse(BaseModel):
    skill_name: str
    difficulty: str
    count: int
    questions: List[GeneratedQuestion]

# High-quality question bank per skill with 10 questions each
CURATED_SKILL_QUESTIONS: Dict[str, List[Dict[str, str]]] = {
    "Python": [
        {
            "question_text": "Explain the difference between mutable and immutable data types in Python. Provide two examples of each.",
            "reference_answer": "Mutable types can have their content modified without changing memory ID (lists, dictionaries, sets). Immutable types cannot be changed once created (tuples, strings, integers, floats).",
            "rubric": "Mentions in-place modification vs new object allocation, and provides correct examples for both."
        },
        {
            "question_text": "How do Python generators work, and what is the advantage of using 'yield' over 'return' when handling large datasets?",
            "reference_answer": "Generators produce items lazily one at a time using 'yield', retaining function state between iterations. This results in O(1) memory consumption compared to returning a full in-memory list.",
            "rubric": "Explains lazy evaluation, iterator protocol, and memory efficiency advantages."
        },
        {
            "question_text": "Describe the Global Interpreter Lock (GIL) in CPython and how it affects multithreaded CPU-bound versus I/O-bound tasks.",
            "reference_answer": "The GIL is a mutex preventing multiple native threads from executing Python bytecodes simultaneously. It limits CPU-bound multithreading (requiring multiprocessing instead), but I/O-bound multithreading still benefits because threads release the GIL during I/O operations.",
            "rubric": "Explains GIL mutex mechanism, why CPU-bound is limited, and why I/O-bound tasks benefit."
        },
        {
            "question_text": "What are Python decorators and how are they implemented using closures or functions as first-class citizens?",
            "reference_answer": "A decorator is a callable that takes a function as an argument and returns a replacement wrapped function. It uses closures to add functionality (like logging or timing) without altering the original function's source code.",
            "rubric": "Explains higher-order functions, wrapping logic, and practical use cases like auth or logging."
        },
        {
            "question_text": "Explain the difference between 'deepcopy' and 'shallow copy' in Python when working with nested data structures.",
            "reference_answer": "A shallow copy creates a new compound object and inserts references to the original nested objects. A deep copy recursively duplicates all nested objects, ensuring mutations in the copy do not affect the original.",
            "rubric": "Identifies reference copying vs recursive object cloning."
        },
        {
            "question_text": "How does memory management and garbage collection work in Python (Reference Counting & Cyclical GC)?",
            "reference_answer": "Python primarily uses reference counting for immediate deallocation when refcount reaches 0, complemented by a generational garbage collector to detect and break circular references.",
            "rubric": "Covers reference counts and cyclic garbage detection across generations."
        },
        {
            "question_text": "Explain context managers in Python. How do the '__enter__' and '__exit__' magic methods ensure resource cleanup?",
            "reference_answer": "Context managers (used in 'with' blocks) guarantee resource acquisition and teardown. '__enter__' sets up the resource and returns it, while '__exit__' handles closing and exceptions even if errors occur.",
            "rubric": "Mentions safe cleanup, exception handling, and custom class implementation."
        },
        {
            "question_text": "What is the difference between '__str__' and '__repr__' dunder methods in Python classes?",
            "reference_answer": "'__str__' is meant to provide a readable, user-friendly string representation, whereas '__repr__' is intended for developers, debugging, and should ideally be valid Python code to recreate the object.",
            "rubric": "Differentiates end-user readability vs developer unambiguous debugging representation."
        },
        {
            "question_text": "How do List Comprehensions compare to 'map()' and 'filter()' in terms of readability and execution speed in modern Python?",
            "reference_answer": "List comprehensions are generally more idiomatic and readable in Python. They avoid lambda function call overhead associated with map/filter and compile down to optimized C-level loop bytecode.",
            "rubric": "Evaluates syntax clarity, lambda overhead, and performance differences."
        },
        {
            "question_text": "Write a Python approach to detect whether two strings are valid anagrams in O(n) time complexity.",
            "reference_answer": "Count frequency of characters in both strings using collections.Counter or a fixed hash map/array of size 26. If the length and character frequencies match, they are anagrams in O(n) time and O(k) space.",
            "rubric": "Provides O(n) algorithm using character counting rather than O(n log n) sorting."
        }
    ],
    "SQL": [
        {
            "question_text": "Explain the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN with practical examples.",
            "reference_answer": "INNER JOIN returns matching rows in both tables. LEFT JOIN returns all rows from the left table and matched rows from the right (with NULLs for non-matches). FULL OUTER JOIN returns all rows when there is a match in either table.",
            "rubric": "Clearly differentiates matched records vs unmatched NULL handling across both tables."
        },
        {
            "question_text": "What are database indexes (B-Tree vs Hash), and when can adding an index negatively impact query performance?",
            "reference_answer": "Indexes speed up read queries (WHERE, JOIN, ORDER BY) by providing fast lookup pointers. However, every INSERT, UPDATE, and DELETE requires updating the index trees, which slows down write-heavy workloads and increases disk usage.",
            "rubric": "Covers read acceleration vs write overhead and storage trade-offs."
        },
        {
            "question_text": "Explain the ACID properties in relational database management systems and why each is critical.",
            "reference_answer": "Atomicity (all-or-nothing transactions), Consistency (preserves schema constraints and invariants), Isolation (concurrent transactions do not interfere), and Durability (committed data survives server crashes).",
            "rubric": "Defines all four ACID letters and their role in transactional reliability."
        },
        {
            "question_text": "How do Window Functions (e.g. ROW_NUMBER(), RANK(), DENSE_RANK()) differ from standard GROUP BY aggregations?",
            "reference_answer": "GROUP BY collapses multiple rows into a single summary row. Window functions calculate values across a set of table rows related to the current row without collapsing the individual rows.",
            "rubric": "Distinguishes row preservation in window calculations vs row collapsing in aggregations."
        },
        {
            "question_text": "What is the difference between WHERE and HAVING clauses in SQL queries?",
            "reference_answer": "WHERE filters individual rows before any grouping or aggregation occurs. HAVING filters aggregated group results after GROUP BY has executed.",
            "rubric": "Accurately identifies filter execution order relative to GROUP BY."
        },
        {
            "question_text": "Explain Database Normalization from 1NF to 3NF and why denormalization is sometimes used in analytics databases.",
            "reference_answer": "1NF ensures atomic column values; 2NF eliminates partial key dependencies; 3NF eliminates transitive dependencies. Denormalization is used in analytical OLAP schemas (star schema) to reduce costly multi-table joins on reads.",
            "rubric": "Describes 1NF, 2NF, 3NF criteria and OLAP read performance justification."
        },
        {
            "question_text": "What is SQL Injection and what are two primary defenses used in production backend development?",
            "reference_answer": "SQL Injection occurs when untrusted user input is directly concatenated into SQL queries, allowing attackers to execute arbitrary SQL. Defenses include Parameterized queries / Prepared statements and using robust ORMs.",
            "rubric": "Explains attack mechanism and parameterized queries/ORM bindings."
        },
        {
            "question_text": "How do database transactions handle concurrency isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable)?",
            "reference_answer": "Isolation levels trade off throughput for consistency by preventing dirty reads, non-repeatable reads, and phantom reads, with Serializable being the strictest level using locking or multi-version concurrency control (MVCC).",
            "rubric": "Describes concurrency anomalies (dirty, phantom reads) across the 4 standard levels."
        },
        {
            "question_text": "Explain the difference between TRUNCATE, DROP, and DELETE statements in SQL.",
            "reference_answer": "DELETE is a DML command that removes specific rows (can be rolled back, fires triggers). TRUNCATE is DDL that quickly removes all rows by deallocating pages (resets identity, no per-row logs). DROP removes the entire table definition and data from the catalog.",
            "rubric": "Distinguishes DML vs DDL, rollback ability, and metadata destruction."
        },
        {
            "question_text": "What is a Common Table Expression (CTE) and when would you use a Recursive CTE?",
            "reference_answer": "A CTE is a temporary named result set defined with the 'WITH' clause for query readability. Recursive CTEs reference themselves to query hierarchical or graph structures (such as organizational charts or nested categories).",
            "rubric": "Defines CTEs and explains hierarchical/tree traversal with recursive CTEs."
        }
    ],
    "React": [
        {
            "question_text": "Explain the Virtual DOM in React and how the Reconciliation / Diffing algorithm optimizes UI updates.",
            "reference_answer": "React maintains a lightweight in-memory representation of the real DOM. When state changes, a new Virtual DOM tree is generated, diffed against the previous tree using heuristic O(n) algorithms, and only the minimal required batch of changes is applied to the real DOM.",
            "rubric": "Covers virtual DOM trees, diffing algorithms, and batched real DOM mutations."
        },
        {
            "question_text": "How does the 'useEffect' hook work, and what are the exact cleanup lifecycle rules when dependencies change?",
            "reference_answer": "useEffect runs side effects after render. If dependencies change, React first runs the cleanup function returned from the previous effect execution before running the new effect. On unmount, the cleanup function runs one final time.",
            "rubric": "Explains dependency tracking, cleanup execution before re-runs, and unmount behavior."
        },
        {
            "question_text": "What are the rules and performance trade-offs of using 'useMemo' and 'useCallback'?",
            "reference_answer": "'useMemo' caches the result of expensive computations, while 'useCallback' caches function references across renders. They prevent unnecessary child re-renders but introduce minor memory and comparison overhead if overused on cheap operations.",
            "rubric": "Distinguishes value memoization vs callback reference stability and performance trade-offs."
        },
        {
            "question_text": "Explain the difference between Controlled and Uncontrolled components in React forms.",
            "reference_answer": "Controlled components have their state managed by React state variables via 'value' and 'onChange'. Uncontrolled components store their own internal state in the DOM and are accessed using 'useRef'.",
            "rubric": "Differentiates React state-driven form inputs vs DOM ref-based inputs."
        },
        {
            "question_text": "How does React Context API handle global state and what causes unnecessary re-renders in consumer components?",
            "reference_answer": "Context shares state down the component tree without prop drilling. Whenever the context value reference changes, all components consuming that context re-render unless split into separate contexts or optimized with memoization.",
            "rubric": "Explains provider/consumer pattern and context value reference re-render implications."
        },
        {
            "question_text": "What is Prop Drilling and what are two architectural solutions to resolve it in modern React?",
            "reference_answer": "Prop drilling is passing props through intermediate components that do not need them just to reach a deep child. Solutions include Context API, Component Composition (passing children / slots), or state management libraries (Zustand/Redux).",
            "rubric": "Defines prop drilling and explains composition or context solutions."
        },
        {
            "question_text": "Explain React Server Components (RSC) and how they differ from traditional Client Components.",
            "reference_answer": "RSCs execute solely on the server, have direct backend/database access, and ship 0 JavaScript bundle to the client. Client components execute on the client, support interactivity, hooks (useState, useEffect), and browser APIs.",
            "rubric": "Distinguishes server-only zero-bundle execution vs client interactive hydration."
        },
        {
            "question_text": "How does Error Boundary work in React and why can't it catch errors in async event handlers?",
            "reference_answer": "Error boundaries are class components implementing 'componentDidCatch' or 'static getDerivedStateFromError' to catch render and lifecycle errors in child trees. They do not catch async/event handler errors because those run outside the render cycle.",
            "rubric": "Explains error boundary lifecycle methods and event handler boundary limits."
        },
        {
            "question_text": "What is the purpose of 'key' prop in React lists and why is using array index as key discouraged for dynamic lists?",
            "reference_answer": "The 'key' prop helps React uniquely identify which items have changed, been added, or removed during reconciliation. Using array index causes rendering bugs and performance degradation when items are reordered, inserted, or filtered.",
            "rubric": "Explains element identity in diffing algorithm and list reordering bugs."
        },
        {
            "question_text": "Explain custom hooks in React. What are the naming conventions and what problem do they solve?",
            "reference_answer": "Custom hooks are JavaScript functions starting with 'use' (e.g. useFetch, useAuth) that can call built-in hooks. They enable reusing stateful business logic across multiple components without duplicating lifecycle code.",
            "rubric": "Covers 'use' prefix convention and cross-component stateful logic reuse."
        }
    ],
    "JavaScript": [
        {
            "question_text": "Explain the JavaScript Event Loop, Call Stack, Microtask Queue (Promises), and Macrotask Queue (setTimeout).",
            "reference_answer": "Synchronous code runs on the Call Stack. When asynchronous tasks complete, microtasks (Promise.then, MutationObserver) are queued in the Microtask Queue, which drains completely before the event loop picks macrotasks (setTimeout, setInterval) from the Macrotask Queue.",
            "rubric": "Covers call stack execution, microtask queue priority over macrotasks, and event loop cycles."
        },
        {
            "question_text": "What is a Closure in JavaScript and how does it enable data encapsulation/privacy?",
            "reference_answer": "A closure is the combination of a function bundled together with references to its surrounding lexical environment. It allows an inner function to retain access to outer function variables even after the outer function has finished executing.",
            "rubric": "Explains lexical scoping, retained scope references, and private variable patterns."
        },
        {
            "question_text": "Explain the difference between '==' (loose equality) and '===' (strict equality) including Type Coercion rules.",
            "reference_answer": "'===' checks both value and type without coercion. '==' coerces operands to a common type before comparison (e.g. '5' == 5 evaluates to true because string '5' is coerced to number 5).",
            "rubric": "Covers type coercion behavior with concrete comparison examples."
        },
        {
            "question_text": "What are the differences between 'var', 'let', and 'const' regarding scope, hoisting, and Temporal Dead Zone (TDZ)?",
            "reference_answer": "'var' is function-scoped and hoisted with undefined initialization. 'let' and 'const' are block-scoped, hoisted but remain in the Temporal Dead Zone (TDZ) until declaration, throwing a ReferenceError if accessed early.",
            "rubric": "Differentiates block vs function scope, TDZ behavior, and reassignment rules."
        },
        {
            "question_text": "How does the 'this' keyword bind in JavaScript across regular functions, arrow functions, and explicit binding (call/apply/bind)?",
            "reference_answer": "In regular functions, 'this' depends on how the function is called at runtime. Arrow functions retain 'this' lexically from their enclosing scope. 'call'/'apply' invoke functions with explicit 'this', and 'bind' returns a new function with fixed 'this'.",
            "rubric": "Covers runtime execution context, lexical arrow binding, and call/apply/bind."
        },
        {
            "question_text": "Explain Prototypes and Prototypal Inheritance in JavaScript. How does the prototype chain work?",
            "reference_answer": "Every JavaScript object has an internal link to another object called its prototype. When accessing a property, JavaScript searches the object itself, then traverses up the '__proto__' chain until it finds the property or reaches 'null'.",
            "rubric": "Describes '__proto__', prototype chain traversal, and method inheritance."
        },
        {
            "question_text": "What is Promise.all() versus Promise.allSettled() and how do they handle rejections?",
            "reference_answer": "Promise.all rejects immediately if any input promise rejects (fail-fast). Promise.allSettled waits for all promises to settle (either resolve or reject) and returns an array of status objects.",
            "rubric": "Explains fail-fast behavior of all() vs complete resolution of allSettled()."
        },
        {
            "question_text": "Explain Debouncing versus Throttling in JavaScript with practical UI examples.",
            "reference_answer": "Debouncing delays execution until a specified delay has passed since the last event (e.g., search autocomplete input). Throttling limits function execution to at most once every X milliseconds (e.g., window scroll or resize handler).",
            "rubric": "Defines delay reset (debounce) vs rate limiting (throttle) with correct use cases."
        },
        {
            "question_text": "What are Async/Await keywords in JavaScript and how do they handle error handling with try/catch?",
            "reference_answer": "Async/await is syntactic sugar over Promises, making asynchronous code read like synchronous code. Rejections inside an async function are caught using standard try/catch blocks.",
            "rubric": "Explains Promise underpinnings and try/catch rejection handling."
        },
        {
            "question_text": "What is Event Bubbling, Event Capturing, and Event Delegation in the DOM?",
            "reference_answer": "Event capturing moves from window down to target; event bubbling propagates from target back up the DOM tree. Event delegation attaches a single listener to a parent element to handle events on dynamic child elements using bubbling.",
            "rubric": "Explains propagation phases and parent-level event delegation efficiency."
        }
    ],
    "FastAPI": [
        {
            "question_text": "How does FastAPI achieve high performance using ASGI, Starlette, and Pydantic?",
            "reference_answer": "FastAPI is built on Starlette for asynchronous routing and ASGI server integration (Uvicorn), and Pydantic for data validation, serialization, and automatic OpenAPI schema generation using Python type hints.",
            "rubric": "Covers ASGI async runtime, Pydantic type validation, and Starlette routing."
        },
        {
            "question_text": "Explain FastAPI's Dependency Injection system ('Depends') and its common use cases.",
            "reference_answer": "FastAPI's 'Depends' allows modular injection of dependencies (database sessions, authentication verification, rate limiters, configuration) into path operation functions, handling lifecycle and cleanup automatically.",
            "rubric": "Explains 'Depends' function, resource cleanup, and auth/DB session injection."
        },
        {
            "question_text": "What is the difference between 'async def' and standard 'def' endpoints in FastAPI?",
            "reference_answer": "'async def' runs directly on the main event loop and should be used for non-blocking I/O (async libraries, httpx). Standard 'def' endpoints are offloaded by FastAPI to an external threadpool to prevent blocking the event loop on synchronous I/O.",
            "rubric": "Explains event loop execution vs threadpool worker offloading."
        },
        {
            "question_text": "How does FastAPI handle automatic API documentation generation (Swagger UI / ReDoc)?",
            "reference_answer": "FastAPI inspects route definitions, status codes, and Pydantic request/response models to dynamically compile an OpenAPI (JSON) specification, which is rendered as interactive Swagger UI at '/docs' and ReDoc at '/redoc'.",
            "rubric": "Mentions OpenAPI spec compilation from Pydantic schemas and /docs interactive UI."
        },
        {
            "question_text": "How do you implement JWT Bearer Token authentication and route protection in FastAPI?",
            "reference_answer": "Use 'HTTPBearer' from fastapi.security and python-jose to decode and verify JWT signatures. Define a 'get_current_user' dependency function that validates the token and returns the authenticated user or raises HTTP 401.",
            "rubric": "Covers HTTPBearer security scheme, JWT decoding, and dependency injection."
        },
        {
            "question_text": "What are Middleware in FastAPI and how do you configure Cross-Origin Resource Sharing (CORSMiddleware)?",
            "reference_answer": "Middleware intercepts requests before they reach endpoints and responses before they leave. CORSMiddleware is configured via 'app.add_middleware(CORSMiddleware, allow_origins=[...])' to control allowed domains, methods, and headers.",
            "rubric": "Explains request/response interception and CORS header authorization."
        },
        {
            "question_text": "How do you handle Background Tasks in FastAPI without blocking client response times?",
            "reference_answer": "FastAPI provides a 'BackgroundTasks' dependency parameter. Tasks added via 'background_tasks.add_task(func, *args)' execute after sending the response to the client, ideal for emails or logging.",
            "rubric": "Explains BackgroundTasks parameter and post-response asynchronous execution."
        },
        {
            "question_text": "How do you customize HTTP exception responses and global exception handlers in FastAPI?",
            "reference_answer": "Raise 'HTTPException(status_code, detail)' for standard errors or register custom exception handlers using '@app.exception_handler(CustomException)' to return custom structured JSON responses.",
            "rubric": "Mentions HTTPException and @app.exception_handler decorators."
        },
        {
            "question_text": "Explain Pydantic Validators ('@field_validator' / '@model_validator') for complex input sanitation.",
            "reference_answer": "Pydantic validators inspect and transform incoming field values before model creation. '@field_validator' validates individual fields (e.g. password strength), while '@model_validator' validates relationships across multiple fields.",
            "rubric": "Covers field-level vs model-level validation and sanitization."
        },
        {
            "question_text": "How do you manage database connections and transactions using SQLModel or SQLAlchemy sessions in FastAPI?",
            "reference_answer": "Define a generator function 'get_session()' that creates a session, yields it to the endpoint via 'Depends(get_session)', and closes the session in a 'finally' block to ensure database connection release.",
            "rubric": "Explains generator session yielding, connection closing, and transaction commits."
        }
    ],
    "Java": [
        {
            "question_text": "Explain the difference between JVM, JRE, and JDK, and how bytecode execution works across platforms.",
            "reference_answer": "JDK includes tools for development and JRE; JRE contains JVM and standard libraries; JVM executes bytecode via Just-In-Time (JIT) compilation to native machine code.",
            "rubric": "Differentiates JDK/JRE/JVM and explains JIT compilation."
        },
        {
            "question_text": "How does Java Garbage Collection work (Generational hypothesis: Eden, Survivor, Tenured/Old Gen)?",
            "reference_answer": "Objects are created in Young Gen (Eden, Survivor). Surviving objects move to Old Generation. Minor GC cleans Young Gen; Major/Full GC cleans Old Gen using algorithms like G1 or ZGC.",
            "rubric": "Explains Young Gen vs Old Gen, Minor/Major GC, and stop-the-world considerations."
        },
        {
            "question_text": "Explain the differences between HashMap, ConcurrentHashMap, and HashTable in multithreaded environments.",
            "reference_answer": "HashMap is not thread-safe. HashTable uses method-level synchronization causing bottlenecks. ConcurrentHashMap uses lock striping or CAS operations to allow concurrent reads and fine-grained concurrent writes.",
            "rubric": "Covers thread safety, synchronized bottlenecks, and ConcurrentHashMap lock striping/CAS."
        },
        {
            "question_text": "What are Java Streams and how do intermediate operations differ from terminal operations?",
            "reference_answer": "Streams provide functional pipelines over collections. Intermediate operations (filter, map) are lazy and return a new Stream. Terminal operations (collect, reduce, forEach) trigger pipeline execution and produce a result.",
            "rubric": "Distinguishes lazy intermediate transformations vs eager terminal triggers."
        },
        {
            "question_text": "Explain the difference between 'synchronized' blocks, 'ReentrantLock', and 'volatile' keywords.",
            "reference_answer": "'volatile' guarantees memory visibility across threads but not atomicity. 'synchronized' provides mutual exclusion and visibility. 'ReentrantLock' adds advanced locking features like fairness, tryLock, and interruptible locks.",
            "rubric": "Distinguishes memory visibility vs mutual exclusion vs lock control flexibility."
        },
        {
            "question_text": "How does Java handle Polymorphism via Dynamic Method Dispatch?",
            "reference_answer": "Overridden methods are resolved at runtime based on the actual object type rather than the reference type, using the object's virtual method table (vtable).",
            "rubric": "Explains runtime dispatch vs compile-time resolution with vtables."
        },
        {
            "question_text": "What is the difference between Checked and Unchecked Exceptions in Java?",
            "reference_answer": "Checked exceptions (subclasses of Exception excluding RuntimeException) are checked at compile time and must be handled or declared. Unchecked exceptions (subclasses of RuntimeException) occur at runtime due to programming errors.",
            "rubric": "Differentiates compile-time enforcement vs runtime faults."
        },
        {
            "question_text": "Explain Java Generics Type Erasure and its implications on runtime type checking and reflection.",
            "reference_answer": "Generics provide compile-time type safety, but type parameters are erased at bytecode compile time into their bounds (or Object). As a result, runtime type checks like 'instanceof T' or creating generic arrays are prohibited.",
            "rubric": "Explains bytecode erasure and runtime generic instantiation restrictions."
        },
        {
            "question_text": "How do Java 21 Virtual Threads (Project Loom) differ from platform threads?",
            "reference_answer": "Virtual threads are lightweight user-mode threads managed by the JVM rather than OS kernel threads. Thousands or millions of virtual threads can run concurrently on a small carrier thread pool without blocking OS threads during I/O.",
            "rubric": "Contrasts 1:1 OS platform threads with JVM M:N lightweight virtual threads."
        },
        {
            "question_text": "Explain the Spring Framework Dependency Injection container and the Bean lifecycle (@Component, @Autowired, @PostConstruct).",
            "reference_answer": "Spring IoC container creates, configures, and manages bean lifecycles. Beans are instantiated, properties injected via @Autowired or constructor injection, @PostConstruct executed, and finally @PreDestroy called during shutdown.",
            "rubric": "Covers IoC inversion of control, bean instantiation, injection, and lifecycle hooks."
        }
    ],
    "C++": [
        {
            "question_text": "Explain RAII (Resource Acquisition Is Initialization) in C++ and how Smart Pointers implement it.",
            "reference_answer": "RAII ties resource lifecycle (memory, sockets, file handles) to object lifetime. When objects go out of scope, their destructors automatically release resources. std::unique_ptr and std::shared_ptr manage heap memory via RAII.",
            "rubric": "Explains scope-based deterministic resource deallocation and smart pointer ownership."
        },
        {
            "question_text": "What are Move Semantics and rvalue references (&&) introduced in C++11?",
            "reference_answer": "Move semantics allow transferring ownership of expensive internal dynamic resources from temporary objects (rvalues) without deep copying, using std::move and move constructors/assignment operators.",
            "rubric": "Differentiates deep copy overhead vs shallow resource pointer transfer using rvalues."
        },
        {
            "question_text": "Explain Virtual Functions, Pure Virtual Functions, and the Virtual Table (vtable / vptr) mechanism.",
            "reference_answer": "Classes with virtual functions contain an invisible vptr pointer to a vtable of function pointers. Calling a virtual method resolves the function address from the vtable at runtime, achieving runtime polymorphism.",
            "rubric": "Explains vtable, vptr, runtime indirect call resolution, and abstract interfaces."
        },
        {
            "question_text": "What is the difference between std::unique_ptr, std::shared_ptr, and std::weak_ptr?",
            "reference_answer": "std::unique_ptr represents exclusive ownership. std::shared_ptr uses reference counting for shared ownership. std::weak_ptr provides a non-owning observer to break circular reference cycles in shared_ptr graphs.",
            "rubric": "Explains exclusive vs ref-counted ownership and weak_ptr cycle prevention."
        },
        {
            "question_text": "Explain C++ Templates, Template Specialization, and SFINAE / Concepts (C++20).",
            "reference_answer": "Templates enable generic compile-time metaprogramming. Specialization provides custom logic for specific types. Concepts (C++20) constrain template parameters with clear compile-time predicate requirements.",
            "rubric": "Covers compile-time code generation, specialization, and constraint concepts."
        },
        {
            "question_text": "What causes Memory Leaks, Dangling Pointers, and Undefined Behavior in manual C++ memory management?",
            "reference_answer": "Memory leaks occur when allocated memory is never freed. Dangling pointers point to deallocated memory addresses. Accessing freed memory or out-of-bounds indices triggers undefined behavior (UB).",
            "rubric": "Identifies delete mismatches, dangling pointer dereferences, and UB consequences."
        },
        {
            "question_text": "What is the difference between Heap and Stack allocation in C++ regarding performance and lifetime?",
            "reference_answer": "Stack allocation is fast, deterministic, automatically popped on function exit, but limited in size. Heap allocation (via new/malloc) is dynamically sized, persistent until explicitly freed, but has allocator overhead and fragmentation.",
            "rubric": "Contrasts allocation speed, size limits, and lifecycle control."
        },
        {
            "question_text": "How do 'const', 'constexpr', and 'consteval' differ in modern C++?",
            "reference_answer": "'const' specifies runtime or compile-time immutability. 'constexpr' indicates a value or function that CAN be evaluated at compile time. 'consteval' mandates that the function MUST be evaluated at compile time.",
            "rubric": "Differentiates runtime read-only vs optional compile-time vs mandatory immediate evaluation."
        },
        {
            "question_text": "Explain Threading and Concurrency primitives in C++ (std::thread, std::mutex, std::lock_guard, std::atomic).",
            "reference_answer": "std::thread spawns OS threads; std::mutex provides mutual exclusion; std::lock_guard provides RAII-style scoped locking; std::atomic enables lock-free operations with hardware memory order guarantees.",
            "rubric": "Covers thread execution, RAII mutex locks, and lockless atomic operations."
        },
        {
            "question_text": "What is the Rule of Three, Rule of Five, and Rule of Zero in modern C++?",
            "reference_answer": "Rule of 3 (C++98): Destructor, Copy Constructor, Copy Assignment. Rule of 5 (C++11): Add Move Constructor, Move Assignment. Rule of 0: Use RAII objects (smart pointers, STL containers) so no custom special member functions are needed.",
            "rubric": "Explains special member function relationships and modern Rule of Zero best practice."
        }
    ],
    "Node.js": [
        {
            "question_text": "Explain Node.js Event-Driven Architecture, libuv thread pool, and non-blocking I/O model.",
            "reference_answer": "Node.js runs single-threaded JavaScript code on the V8 engine and delegates asynchronous I/O (filesystem, DNS, crypto) to the underlying C-based libuv thread pool, handling events via the event loop phases.",
            "rubric": "Explains single-threaded JS loop + libuv threadpool asynchronous delegation."
        },
        {
            "question_text": "What are Streams in Node.js (Readable, Writable, Transform) and how does backpressure work?",
            "reference_answer": "Streams process data in chunks without loading entire files into memory. Backpressure occurs when a Writable stream signals the Readable stream to pause reading when its internal buffer is full.",
            "rubric": "Describes chunked streaming and buffer-overflow handling with backpressure."
        },
        {
            "question_text": "How do Cluster Module and Worker Threads differ when scaling Node.js applications?",
            "reference_answer": "Cluster module forks separate Node.js processes sharing server ports (multi-process for multi-core scaling). Worker Threads run multiple JS threads sharing memory in a single process (for CPU-intensive calculations).",
            "rubric": "Differentiates multi-process clustering vs in-process worker multithreading."
        },
        {
            "question_text": "What is the difference between process.nextTick() and setImmediate() in the Node.js event loop?",
            "reference_answer": "process.nextTick() executes immediately after the current operation before the event loop continues (microtask phase). setImmediate() executes on the Check phase of the event loop cycle.",
            "rubric": "Explains microtask priority of nextTick over check-phase setImmediate."
        },
        {
            "question_text": "How do you protect Node.js backend APIs against common security vulnerabilities like ReDoS, NoSQL/SQL Injection, and Prototype Pollution?",
            "reference_answer": "Using regex limits/timeouts, parameterized queries, Object.freeze or schema validation (Joi/Zod), rate limiting (express-rate-limit), and security headers (helmet).",
            "rubric": "Covers Prototype Pollution, ReDoS, injection attacks, and defensive middleware."
        },
        {
            "question_text": "Explain the difference between CommonJS ('require') and ECMAScript Modules ('import') in Node.js.",
            "reference_answer": "CommonJS loads synchronously at runtime with dynamic evaluation. ESM modules are statically analyzed at compile time, support top-level await, and enable better tree-shaking.",
            "rubric": "Contrasts synchronous runtime resolution vs static asynchronous ESM loading."
        },
        {
            "question_text": "How do you manage memory leaks in Node.js applications and what tools are used for profiling?",
            "reference_answer": "Common leaks come from global variables, uncleared intervals, or closure references. Profiling tools include Chrome DevTools (--inspect), clinic.js, and generating heap snapshots via v8-profiler.",
            "rubric": "Mentions leak sources (closures, event listeners) and profiling tools (heap snapshots, clinic)."
        },
        {
            "question_text": "What is Middleware in Express.js and how does error-handling middleware differ from standard route middleware?",
            "reference_answer": "Standard middleware takes (req, res, next). Error-handling middleware takes 4 arguments (err, req, res, next) and is placed at the end of the pipeline to catch unhandled downstream errors.",
            "rubric": "Highlights 4-parameter error signature and execution placement."
        },
        {
            "question_text": "How does NPM package management handle dependency resolution, lockfiles, and semantic versioning (^ vs ~)?",
            "reference_answer": "package-lock.json locks exact transitive dependency versions. '^' allows minor updates (< 2.0.0 for ^1.2.0), while '~' only allows patch updates (< 1.3.0 for ~1.2.0).",
            "rubric": "Differentiates caret minor upgrades vs tilde patch upgrades and lockfile determinism."
        },
        {
            "question_text": "Explain how to build scalable microservices or message queue consumers using Node.js and Redis / RabbitMQ.",
            "reference_answer": "Decouple services using publish/subscribe or work queues. Worker processes consume jobs asynchronously with ack/nack semantics, enabling horizontal scaling without blocking HTTP gateways.",
            "rubric": "Explains asynchronous decoupled queuing, acknowledgment mechanisms, and worker scaling."
        }
    ],
    "Data Structures": [
        {
            "question_text": "Explain the time and space complexity trade-offs between Arrays and Linked Lists for insertions, deletions, and random access.",
            "reference_answer": "Arrays offer O(1) random access due to contiguous memory, but O(n) insertions/deletions. Linked lists have O(1) insertion/deletion given a pointer, but O(n) traversal access and higher pointer memory overhead.",
            "rubric": "Contrasts contiguous memory indexing with pointer traversal and memory overhead."
        },
        {
            "question_text": "How does a Hash Table resolve hash collisions using Separate Chaining versus Open Addressing (Linear/Quadratic Probing)?",
            "reference_answer": "Separate Chaining stores colliding elements in a linked list or balanced tree at each bucket. Open Addressing searches for alternative empty slots within the array table itself using probing algorithms.",
            "rubric": "Explains linked buckets vs internal array probing and load factor impacts."
        },
        {
            "question_text": "What is a Binary Search Tree (BST) and why can it degrade to O(n) time complexity? How do AVL and Red-Black Trees prevent this?",
            "reference_answer": "Unbalanced BSTs can degenerate into linked lists on sorted input. Self-balancing trees (AVL with strict height balancing, Red-Black with color rules) perform tree rotations to guarantee O(log n) worst-case operations.",
            "rubric": "Explains tree degeneration and auto-balancing via tree rotations."
        },
        {
            "question_text": "Explain Min-Heap / Max-Heap properties and how Priority Queues are implemented using array-backed binary heaps.",
            "reference_answer": "In a Min-Heap, every parent node is <= its children. Implemented in an array where children of index i are at 2i+1 and 2i+2. Push and pop operations take O(log n) via heapify-up and heapify-down.",
            "rubric": "Covers parent-child ordering invariant, array index math, and O(log n) heapify operations."
        },
        {
            "question_text": "What is a Trie (Prefix Tree) and why is it preferred over Hash Tables for autocomplete and prefix search?",
            "reference_answer": "A Trie stores keys as paths along shared prefix characters. Prefix search is O(L) where L is string length, independent of the total number of dictionary words, and naturally supports prefix enumeration.",
            "rubric": "Explains shared prefix branches and O(L) lookup complexity."
        },
        {
            "question_text": "How do Breadth-First Search (BFS) and Depth-First Search (DFS) differ in Graph traversal and space complexity?",
            "reference_answer": "BFS uses a FIFO Queue exploring level by level (finds shortest unweighted path; space O(V)). DFS uses a LIFO Stack / recursion exploring branches deeply (space O(depth)).",
            "rubric": "Contrasts queue vs stack, shortest-path guarantee, and memory space bounds."
        },
        {
            "question_text": "Explain how a Disjoint Set Union (DSU / Union-Find) achieves near O(1) amortized operations using Path Compression and Union by Rank.",
            "reference_answer": "Union-Find manages disjoint sets. Path compression flattens tree depth during find operations, and Union by Rank attaches smaller trees under larger ones, achieving inverse Ackermann O(alpha(n)) amortized time.",
            "rubric": "Explains path compression, rank heuristics, and inverse Ackermann time."
        },
        {
            "question_text": "What is a Segment Tree or Fenwick Tree (Binary Indexed Tree) and what problem do they solve in O(log n) time?",
            "reference_answer": "They support dynamic range queries (range sum, range minimum) and point updates in O(log n) time, outperforming static O(1) prefix sum arrays when values mutate frequently.",
            "rubric": "Explains mutable range queries and O(log n) update vs query trade-off."
        },
        {
            "question_text": "How do LRU (Least Recently Used) Caches achieve O(1) get() and put() operations using Hash Map + Doubly Linked List?",
            "reference_answer": "The Hash Map provides O(1) node lookup. The Doubly Linked List maintains access recency order, allowing O(1) removal of the tail node (least recently used) and moving accessed nodes to head.",
            "rubric": "Explains Hash Map pointer lookup combined with doubly linked list splice operations."
        },
        {
            "question_text": "Explain B-Trees and B+ Trees and why database storage engines use B+ Trees over standard binary trees.",
            "reference_answer": "B+ Trees are multi-way self-balancing search trees optimized for disk block reads. Internal nodes store only keys for branching (high fan-out), while all data resides in linked leaf nodes for fast sequential range scans.",
            "rubric": "Covers high fan-out disk block optimization and linked leaf nodes for range queries."
        }
    ]
}

def get_default_questions_for_skill(skill_name: str, num_questions: int, difficulty: str) -> List[GeneratedQuestion]:
    """Provides high-quality questions for any catalog skill."""
    if skill_name in CURATED_SKILL_QUESTIONS:
        pool = CURATED_SKILL_QUESTIONS[skill_name]
    else:
        # Generic high-quality technical questions
        pool = [
            {
                "question_text": f"Explain the core architectural principles, syntax conventions, and primary use cases of {skill_name}.",
                "reference_answer": f"{skill_name} is used to build robust, scalable systems by adhering to modular design patterns, clean interfaces, and standardized best practices.",
                "rubric": "Evaluates foundational understanding of core concepts, paradigms, and practical applications."
            },
            {
                "question_text": f"What are common performance bottlenecks when working with {skill_name}, and how do you optimize them?",
                "reference_answer": "Optimization involves reducing redundant computation, managing memory allocation, using efficient data structures, and profiling execution bottlenecks.",
                "rubric": "Mentions profiling, algorithmic efficiency, and memory/resource management."
            },
            {
                "question_text": f"How do you handle error handling, debugging, and edge cases effectively in {skill_name}?",
                "reference_answer": "Structured exception handling, defensive input validation, automated logging, and comprehensive unit tests ensure robust resilience against unexpected edge cases.",
                "rubric": "Covers exception handling, logging, testing, and defensive programming."
            },
            {
                "question_text": f"Describe a real-world scenario where you would choose {skill_name} over alternative technologies.",
                "reference_answer": f"Selection criteria includes performance requirements, ecosystem tooling, developer velocity, maintainability, and concurrency demands tailored to {skill_name}.",
                "rubric": "Demonstrates comparative analysis and practical architectural decision making."
            },
            {
                "question_text": f"What security best practices and vulnerability mitigations should always be implemented when developing with {skill_name}?",
                "reference_answer": "Sanitizing all user inputs, preventing injection vulnerabilities, enforcing principle of least privilege, and keeping third-party dependencies updated.",
                "rubric": "Covers input sanitation, authentication/authorization, and secure dependency management."
            },
            {
                "question_text": f"How does {skill_name} manage concurrency, asynchronous execution, or multithreading?",
                "reference_answer": "Mechanisms include event loops, thread pools, coroutines, or message passing depending on whether tasks are I/O-bound or CPU-bound.",
                "rubric": "Explains concurrency models, thread safety, and asynchronous execution paradigms."
            },
            {
                "question_text": f"Explain how you would write automated unit and integration tests for a project built with {skill_name}.",
                "reference_answer": "Using testing frameworks, mocking external dependencies, asserting expected outputs, and measuring code coverage to ensure software reliability.",
                "rubric": "Mentions test suites, mocking/fixtures, and test coverage strategies."
            },
            {
                "question_text": f"What design patterns (e.g. Factory, Singleton, Observer, Repository) are most commonly applied in {skill_name}?",
                "reference_answer": "Patterns like Repository pattern for data abstraction, Factory pattern for object instantiation, and Observer pattern for event handling promote modular architecture.",
                "rubric": "Identifies standard software engineering design patterns and their implementations."
            },
            {
                "question_text": f"How do you approach state management and data lifecycle in applications using {skill_name}?",
                "reference_answer": "Establishing unidirectional data flow, immutability, centralized stores, and predictable state mutations across application boundaries.",
                "rubric": "Explains state predictability, caching, and persistence mechanisms."
            },
            {
                "question_text": f"Explain the CI/CD and deployment pipeline best practices for applications using {skill_name}.",
                "reference_answer": "Automated linting, containerization with Docker, running automated test suites on pull requests, and automated deployment to staging/production.",
                "rubric": "Covers automated build steps, containerization, and continuous deployment best practices."
            }
        ]

    # Select requested number of questions (up to available)
    selected = pool[:min(num_questions, len(pool))]
    if len(selected) < num_questions:
        selected = pool

    return [
        GeneratedQuestion(
            question_text=q["question_text"],
            reference_answer=q["reference_answer"],
            rubric=q["rubric"]
        )
        for q in selected[:num_questions]
    ]


import socket
import time

_ollama_status_cache = {"online": False, "checked_at": 0.0}

def is_ollama_alive(host: str = "127.0.0.1", port: int = 11434, timeout: float = 0.05) -> bool:
    """Instantly checks if local Ollama port is open with a 15-second TTL cache."""
    now = time.time()
    if now - _ollama_status_cache["checked_at"] < 15.0:
        return _ollama_status_cache["online"]

    try:
        with socket.create_connection((host, port), timeout=timeout):
            _ollama_status_cache["online"] = True
    except (OSError, socket.timeout):
        _ollama_status_cache["online"] = False

    _ollama_status_cache["checked_at"] = now
    return _ollama_status_cache["online"]

async def call_ollama_generate(prompt: str) -> Optional[str]:
    """Attempts to call local Ollama instance if available, otherwise returns None immediately."""
    if not is_ollama_alive():
        return None
    try:
        timeout_cfg = httpx.Timeout(4.0, connect=0.5)
        async with httpx.AsyncClient(timeout=timeout_cfg) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": MODEL_NAME, "prompt": prompt, "stream": False}
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response", "")
    except Exception:
        pass
    return None


@router.post("/llm/generate-questions", response_model=GenerateQuestionsResponse, tags=["LLM Questions"])
async def generate_questions_llm(req: GenerateQuestionsRequest, db: Session = Depends(get_session)):
    """
    Generates 5 to 10 comprehensive assessment questions for a skill using LLM
    with high-quality curated question fallback.
    """
    skill = db.exec(select(Skill).where(Skill.name == req.skill_name)).first()
    skill_title = skill.name if skill else req.skill_name

    topics_str = ", ".join(req.topics) if req.topics else "core fundamentals, advanced patterns, problem solving"

    prompt = (
        f"You are an expert technical interviewer. "
        f"Generate exactly {req.num_questions} rigorous technical assessment question(s) for the skill: {skill_title}. "
        f"Difficulty: {req.difficulty}. Focus areas: {topics_str}. "
        f"Output ONLY a valid JSON array. Each element must contain 'question_text', 'reference_answer', 'rubric'. "
        f"Example: [{{\"question_text\": \"Question?\", \"reference_answer\": \"Answer.\", \"rubric\": \"Rubric.\"}}]"
    )

    raw_text = await call_ollama_generate(prompt)

    if raw_text:
        try:
            start = raw_text.find("[")
            end = raw_text.rfind("]") + 1
            if start != -1 and end > 0:
                parsed = json.loads(raw_text[start:end])
                if isinstance(parsed, list) and len(parsed) >= req.num_questions:
                    valid_questions = []
                    for q in parsed[:req.num_questions]:
                        if all(k in q for k in ("question_text", "reference_answer", "rubric")):
                            valid_questions.append(GeneratedQuestion(
                                question_text=q["question_text"],
                                reference_answer=q["reference_answer"],
                                rubric=q["rubric"]
                            ))
                    if len(valid_questions) >= req.num_questions:
                        return GenerateQuestionsResponse(
                            skill_name=skill_title,
                            difficulty=req.difficulty,
                            count=len(valid_questions),
                            questions=valid_questions
                        )
        except Exception:
            pass

    # Fallback to curated 5-10 questions
    fallback_questions = get_default_questions_for_skill(skill_title, req.num_questions, req.difficulty)

    return GenerateQuestionsResponse(
        skill_name=skill_title,
        difficulty=req.difficulty,
        count=len(fallback_questions),
        questions=fallback_questions
    )