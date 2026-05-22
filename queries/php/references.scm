; PHP Reference / Dependency Extraction

(require_once_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

(require_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

(include_once_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

(include_expression
  (parenthesized_expression
    (string
      (string_content) @ref.target_require))) @ref.type_require

; F05: Namespace use clauses
(namespace_use_clause) @ref.target_use_clause

; Inheritance
(class_declaration
  (base_clause
    (name) @ref.target_extends)) @ref.type_extends

(class_declaration
  (class_interface_clause
    (name) @ref.target_implements)) @ref.type_implements

; Instantiation
(object_creation_expression
  (name) @ref.target_instantiation) @ref.type_instantiation

; Scoped calls
(scoped_call_expression
  scope: (name) @ref.target_call) @ref.type_call

; Member calls
(member_call_expression
  name: (name) @ref.target_call) @ref.type_call

; F06: Type-hint dependencies
(property_promotion_parameter) @ref.target_param
(simple_parameter) @ref.target_param
(method_declaration return_type: (_) @ref.target_return_type)
(function_definition return_type: (_) @ref.target_return_type)
(property_declaration) @ref.target_property

; F07: Eloquent relationships
(member_call_expression
  name: (name) @ref.relation_method_name
  (#match? @ref.relation_method_name "^(hasOne|hasMany|hasOneThrough|hasManyThrough|belongsTo|belongsToMany|morphTo|morphOne|morphMany|morphToMany|morphedByMany|hasOneOfMany)$")
  arguments: (arguments) @ref.relation_arguments
) @ref.type_relation_call

; F08: Route controller binding (statically matched)
(scoped_call_expression
  scope: (name) @_route_class (#eq? @_route_class "Route")
  name: (name) @ref.route_method_name
  arguments: (arguments) @ref.route_arguments
) @ref.type_route_call

; F08: Middleware chaining
(member_call_expression
  name: (name) @_mw_name (#eq? @_mw_name "middleware")
  arguments: (arguments) @ref.middleware_arguments
) @ref.type_middleware_call

; F09: Container Bindings
(member_call_expression
  name: (name) @ref.binding_method_name
  (#match? @ref.binding_method_name "^(bind|singleton|scoped|instance|alias)$")
  arguments: (arguments) @ref.binding_arguments
) @ref.type_binding_call
