(import_from_statement
  [(dotted_name) (identifier)] @ref.target_import) @ref.type_import

(import_statement
  [(dotted_name) (identifier)] @ref.target_import) @ref.type_import

(class_definition
  superclasses: (argument_list
    (identifier) @ref.target_extends)) @ref.type_extends

(call
  function: (identifier) @ref.target_call) @ref.type_call

(call
  function: (attribute
    attribute: (identifier) @ref.target_call)) @ref.type_call
