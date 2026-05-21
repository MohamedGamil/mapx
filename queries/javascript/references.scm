; JavaScript Reference / Dependency Extraction

(import_statement
  source: (string) @ref.target_import) @ref.type_import

(class_declaration
  (class_heritage
    (identifier) @ref.target_extends)) @ref.type_extends

(new_expression
  constructor: (identifier) @ref.target_instantiation) @ref.type_instantiation

(call_expression
  function: (identifier) @ref.target_call) @ref.type_call
