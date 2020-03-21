const PREC = {
  conditional: -1,

  parenthesized_expression: 1,

  // https://nim-lang.org/docs/manual.html#syntax-precedence
  op0: 9,
  op1: 10,
  op2: 11,
  op3: 12,
  op4: 13,
  op5: 14,
  op6: 15,
  op7: 16,
  op8: 17,
  op9: 18,
  op10: 19,

  call: 20,
}

module.exports = grammar({
  name: 'nim',

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\\\r?\n/
  ],

  supertypes: $ => [
    $._simple_statement,
    $._compound_statement,
    $._expression,
    $._primary_expression,
    $._parameter,
  ],

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent,
    $._string_start,
    $._string_content,
    $._string_end,
  ],

  inline: $ => [
    $._simple_statement,
    $._compound_statement,
    $.keyword_identifier,
    $._suite,
    $._parameter,
  ],

  word: $ => $.identifier,

  rules: {
    module: $ => repeat($._statement),

    _statement: $ => choice(
      $._simple_statements,
      $._compound_statement
    ),

    // Simple statements

    _simple_statements: $ => seq(
      $._simple_statement,
      optional(repeat(seq(
        $._semicolon,
        $._simple_statement
      ))),
      optional($._semicolon),
      $._newline
    ),

    _simple_statement: $ => choice(
      $.import_statement,
      $.import_from_statement,
      $.echo_statement,
      $.assert_statement,
      $.expression_statement,
      $.return_statement,
      $.delete_statement,
      $.raise_statement,
      $.pass_statement,
      $.break_statement,
      $.continue_statement,
      $.global_statement,
      $.nonlocal_statement,
      $.exec_statement
    ),

    import_statement: $ => seq(
      'import',
      $._import_list
    ),

    import_prefix: $ => repeat1('.'),

    relative_import: $ => seq(
      $.import_prefix,
      optional($.dotted_name)
    ),

    import_from_statement: $ => seq(
      'from',
      field('module_name', choice(
        $.relative_import,
        $.dotted_name
      )),
      'import',
      choice(
        $.wildcard_import,
        $._import_list,
        seq('(', $._import_list, ')')
      )
    ),

    _import_list: $ => seq(
      commaSep1(field('name', choice(
        $.dotted_name,
        $.aliased_import
      ))),
      optional(',')
    ),

    aliased_import: $ => seq(
      field('name', $.dotted_name),
      'as',
      field('alias', $.identifier)
    ),

    wildcard_import: $ => '*',

    echo_statement: $ =>
      prec(-1, seq(
        'echo',
        commaSep1(field('argument', $._expression)),
        optional(','))
      ),

    assert_statement: $ => seq(
      'assert',
      commaSep1($._expression)
    ),

    expression_statement: $ => choice(
      $._expression,
      seq(commaSep1($._expression), optional(',')),
      $.assignment,
      $.declaration,
      $.augmented_assignment,
      $.yield
    ),

    named_expression: $ => seq(
      field('name', $.identifier),
      ':=',
      field('value', $._expression)
    ),

    return_statement: $ => seq(
      'return',
      optional($.expression_list)
    ),

    delete_statement: $ => seq(
      'del',
      $.expression_list
    ),

    raise_statement: $ => seq(
      'raise',
      optional($.expression_list),
      optional(seq('from', field('cause', $._expression)))
    ),

    pass_statement: $ => prec.left('pass'),
    break_statement: $ => prec.left('break'),
    continue_statement: $ => prec.left('continue'),

    // Compount statements

    _compound_statement: $ => choice(
      $.if_statement,
      $.for_statement,
      $.while_statement,
      $.try_statement,
      $.with_statement,
      $.function_definition,
    ),

    if_statement: $ => seq(
      'if',
      field('condition', $._expression),
      ':',
      field('consequence', $._suite),
      repeat(field('alternative', $.elif_clause)),
      optional(field('alternative', $.else_clause))
    ),

    elif_clause: $ => seq(
      'elif',
      field('condition', $._expression),
      ':',
      field('consequence', $._suite)
    ),

    else_clause: $ => seq(
      'else',
      ':',
      field('body', $._suite)
    ),

    if_expression: $ => prec.right(PREC.conditional, seq(
      'if',
      field('condition', $._expression),
      ':',
      field('consequence', $._expression),
      repeat(field('alternative', $.elif_expression)),
      optional(field('alternative', $.else_expression))
    )),

    elif_expression: $ => seq(
      'elif',
      field('condition', $._expression),
      ':',
      field('consequence', $._expression)
    ),

    else_expression: $ => seq(
      'else',
      ':',
      field('body', $._expression)
    ),

    for_statement: $ => seq(
      'for',
      field('left', $.variables),
      'in',
      field('right', $.expression_list),
      ':',
      field('body', $._suite)
    ),

    while_statement: $ => seq(
      'while',
      field('condition', $._expression),
      ':',
      field('body', $._suite),
      optional(field('alternative', $.else_clause))
    ),

    try_statement: $ => seq(
      'try',
      ':',
      field('body', $._suite),
      choice(
        seq(
          repeat1($.except_clause),
          optional($.else_clause),
          optional($.finally_clause)
        ),
        $.finally_clause
      )
    ),

    except_clause: $ => seq(
      'except',
      optional(seq(
        $._expression,
        optional(seq(
          choice('as', ','),
          $._expression
        ))
      )),
      ':',
      $._suite
    ),

    finally_clause: $ => seq(
      'finally',
      ':',
      $._suite
    ),

    with_statement: $ => seq(
      'with',
      commaSep1($.with_item),
      ':',
      field('body', $._suite)
    ),

    with_item: $ => seq(
      field('value', $._expression),
      optional(seq(
        'as',
        field('alias', $._expression)
      ))
    ),

    function_definition: $ => seq(
      choice('proc', 'func'),
      field('name', $.identifier),
      field('parameters', $.parameters),
      optional(
        seq(
          ':',
          field('return_type', $.type)
        )
      ),
      '=',
      field('body', $._suite)
    ),

    parameters: $ => seq(
      '(',
      optional($._parameters),
      ')'
    ),

    _parameters: $ => seq(
      commaSep1($._parameter),
      optional(',')
    ),

    _parameter: $ => choice(
      $.identifier,
      $.keyword_identifier,
      $.tuple,
      $.typed_parameter,
      $.default_parameter,
      $.typed_default_parameter
    ),

    default_parameter: $ => seq(
      field('name', choice($.identifier, $.keyword_identifier)),
      '=',
      field('value', $._expression)
    ),

    typed_default_parameter: $ => seq(
      field('name', choice($.identifier, $.keyword_identifier)),
      ':',
      field('type', $.type),
      '=',
      field('value', $._expression)
    ),

    global_statement: $ => seq(
      'global',
      commaSep1($.identifier)
    ),

    nonlocal_statement: $ => seq(
      'nonlocal',
      commaSep1($.identifier)
    ),

    exec_statement: $ => seq(
      'exec',
      field('code', $.string),
      optional(
        seq(
          'in',
          commaSep1($._expression)
        )
      )
    ),

    argument_list: $ => seq(
      '(',
      optional(commaSep1(
        choice(
          $._expression,
          $.keyword_argument
        )
      )),
      optional(','),
      ')'
    ),

    _suite: $ => choice(
      alias($._simple_statements, $.block),
      seq($._indent, $.block)
    ),

    block: $ => seq(
      repeat($._statement),
      $._dedent
    ),

    variables: $ => seq(
      commaSep1(choice($.identifier, $.tuple)),
      optional(',')
    ),

    expression_list: $ => prec.right(seq(
      commaSep1($._expression),
      optional(',')
    )),

    dotted_name: $ => sep1($.identifier, '.'),

    // Expressions

    _expression: $ => choice(
      $.lambda,
      $._primary_expression,
      $.if_expression,
      $.named_expression
    ),

    _primary_expression: $ => choice(
      $.operator,
      $.identifier,
      $.keyword_identifier,
      $.string,
      $.concatenated_string,
      $.integer,
      $.float,
      $.true,
      $.false,
      $.none,
      $.attribute,
      $.subscript,
      $.call,
      $.list,
      $.list_comprehension,
      $.dictionary,
      $.dictionary_comprehension,
      $.set,
      $.set_comprehension,
      $.tuple,
      $.parenthesized_expression,
      $.generator_expression,
      $.ellipsis
    ),

    operator: $ => {
      // https://nim-lang.org/docs/manual.html#lexical-analysis-operators
      const table = [
        // arrow
        [prec.left, /[=+\-*/<>@$~&%|!?\^.:\\]*->/, PREC.op0],
        [prec.left, /[=+\-*/<>@$~&%|!?\^.:\\]*=>/, PREC.op0],
        [prec.left, /[=+\-*/<>@$~&%|!?\^.:\\]*~>/, PREC.op0],
        // assignment
        // If the operator ends with = and its first character is none of <, >, !, =, ~, ?
        [prec.left, /[+\-*/@$&%|\^.:\\]+[=+\-*/<>@$~&%|!?\^.:\\]*=/, PREC.op1],
        // (first char @ : ?)
        [prec.left, /[@:?][=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op2],
        // or xor
        [prec.left, 'or', PREC.op3],
        [prec.left, 'xor', PREC.op3],
        // and
        [prec.left, 'and', PREC.op4],
        // in notin is isnot not of (first char = < > !)
        [prec.left, 'in', PREC.op5],
        [prec.left, 'notin', PREC.op5],
        [prec.left, 'is', PREC.op5],
        [prec.left, 'isnot', PREC.op5],
        [prec.left, 'not', PREC.op5],
        [prec.left, 'of', PREC.op5],
        [prec.left, /[=<>!][=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op5],
        // (first char .)
        [prec.left, /\.[=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op6],
        // (first char &)
        [prec.left, /&[=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op7],
        // (first char + - ~ |)
        [prec.left, /[+\-~|][=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op8],
        // (first char * % \ /)
        [prec.left, /[*%\\/][=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op9],
        [prec.left, 'div', PREC.op9],
        [prec.left, 'mod', PREC.op9],
        [prec.left, 'shl', PREC.op9],
        [prec.left, 'shr', PREC.op9],
        // (first char $ ^)
        [prec.left, /\$[=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op10],
        [prec.right, /\^[=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op10],
      ];

      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        optional(field('left', $._primary_expression)),
        field('operator', operator),
        field('right', $._primary_expression)
      ))));
    },

    lambda: $ => seq(
      'proc',
      field('parameters', $.parameters),
      ':',
      field('type', $.type),
      '=',
      field('body', $._expression)
    ),

    assignment: $ => seq(
      field('left', $.expression_list),
      seq('=', field('right', $._right_hand_side))
    ),

    declaration: $ => seq(
      choice('var', 'let', 'const'),
      field('left', $.expression_list),
      choice(
        seq('=', field('right', $._right_hand_side)),
        seq(':', field('type', $.type)),
        seq(':', field('type', $.type), '=', field('right', $._right_hand_side))
      )
    ),

    augmented_assignment: $ => seq(
      field('left', $.expression_list),
      field('operator', choice(
        '+=', '-=', '*=', '/=', '@=', '//=', '%=', '**=',
        '>>=', '<<=', '&=', '^=', '|='
      )),
      field('right', $._right_hand_side)
    ),

    _right_hand_side: $ => choice(
      $.expression_list,
      $.assignment,
      $.augmented_assignment,
      $.yield
    ),

    yield: $ => seq(
      'yield',
      choice(
        seq(
          'from',
          $._expression
        ),
        optional($.expression_list)
      )
    ),

    attribute: $ => prec(PREC.call, seq(
      field('object', $._primary_expression),
      '.',
      field('attribute', $.identifier)
    )),

    subscript: $ => seq(
      field('value', $._primary_expression),
      '[',
      field('subscript', commaSep1(choice($._expression, $.slice))),
      optional(','),
      ']'
    ),

    slice: $ => seq(
      optional($._expression),
      ':',
      optional($._expression),
      optional(seq(':', optional($._expression)))
    ),

    ellipsis: $ => '...',

    call: $ => prec(PREC.call, seq(
      field('function', $._primary_expression),
      field('arguments', choice(
        $.generator_expression,
        $.argument_list
      ))
    )),

    typed_parameter: $ => seq(
      $.identifier,
      ':',
      field('type', $.type)
    ),

    type: $ => $._expression,

    keyword_argument: $ => seq(
      field('name', choice($.identifier, $.keyword_identifier)),
      '=',
      field('value', $._expression)
    ),

    // Literals

    list: $ => seq(
      '[',
      optional(commaSep1($._expression)),
      optional(','),
      ']'
    ),

    _comprehension_clauses: $ => seq(
      $.for_in_clause,
      repeat(choice(
        $.for_in_clause,
        $.if_clause
      ))
    ),

    list_comprehension: $ => seq(
      '[',
      field('body', $._expression),
      $._comprehension_clauses,
      ']'
    ),

    dictionary: $ => seq(
      '{',
      optional(commaSep1($.pair)),
      optional(','),
      '}'
    ),

    dictionary_comprehension: $ => seq(
      '{',
      field('body', $.pair),
      $._comprehension_clauses,
      '}'
    ),

    pair: $ => seq(
      field('key', $._expression),
      ':',
      field('value', $._expression)
    ),

    set: $ => seq(
      '{',
      commaSep1($._expression),
      optional(','),
      '}'
    ),

    set_comprehension: $ => seq(
      '{',
      field('body', $._expression),
      $._comprehension_clauses,
      '}'
    ),

    parenthesized_expression: $ => prec(PREC.parenthesized_expression, seq(
      '(',
      choice($._expression, $.yield),
      ')'
    )),

    tuple: $ => seq(
      '(',
      optional(commaSep1(choice($._expression, $.yield))),
      optional(','),
      ')'
    ),

    generator_expression: $ => seq(
      '(',
      field('body', $._expression),
      $._comprehension_clauses,
      ')'
    ),

    for_in_clause: $ => seq(
      'for',
      field('left', $.variables),
      'in',
      field('right', commaSep1($._primary_expression))
    ),

    if_clause: $ => seq(
      'if',
      $._expression
    ),

    concatenated_string: $ => seq(
      $.string,
      repeat1($.string)
    ),

    string: $ => seq(
      alias($._string_start, '"'),
      repeat(choice($.interpolation, $.escape_sequence, $._not_escape_sequence, $._string_content)),
      alias($._string_end, '"')
    ),

    interpolation: $ => seq(
      '{',
      $._expression,
      optional($.type_conversion),
      optional($.format_specifier),
      '}'
    ),

    escape_sequence: $ => token(prec(1, seq(
      '\\',
      choice(
        /u[a-fA-F\d]{4}/,
        /U[a-fA-F\d]{8}/,
        /x[a-fA-F\d]{2}/,
        /\d{3}/,
        /\r?\n/,
        /['"abfrntv\\]/,
      )
    ))),

    _not_escape_sequence: $ => '\\',

    format_specifier: $ => seq(
      ':',
      repeat(choice(
        /[^{}\n]+/,
        $.format_expression
      ))
    ),

    format_expression: $ => seq('{', $._expression, '}'),

    type_conversion: $ => /![a-z]/,

    integer: $ => token(choice(
      seq(
        choice('0x', '0X'),
        repeat1(/_?[A-Fa-f0-9]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0o', '0O'),
        repeat1(/_?[0-7]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0b', '0B'),
        repeat1(/_?[0-1]+/),
        optional(/[Ll]/)
      ),
      seq(
        repeat1(/[0-9]+_?/),
        choice(
          optional(/[Ll]/), // long numbers
          optional(/[jJ]/) // complex numbers
        )
      )
    )),

    float: $ => {
      const digits = repeat1(/[0-9]+_?/);
      const exponent = seq(/[eE][\+-]?/, digits)

      return token(seq(
        choice(
          seq(digits, '.', optional(digits), optional(exponent)),
          seq(optional(digits), '.', digits, optional(exponent)),
          seq(digits, exponent)
        ),
        optional(choice(/[Ll]/, /[jJ]/))
      ))
    },

    identifier: $ => /[a-zA-Zα-ωΑ-Ω_][a-zA-Zα-ωΑ-Ω_0-9]*/,

    keyword_identifier: $ => alias(choice('print', 'exec'), $.identifier),

    true: $ => 'true',
    false: $ => 'false',
    none: $ => 'nil',

    comment: $ => token(choice(
      seq(/#[^\[]/, /.*/),
      seq('#[', /[^\]]*\]+([^#\]][^\]]*\]+)*/, '#')
    )),

    _semicolon: $ => ';'
  }
})

function commaSep1 (rule) {
  return sep1(rule, ',')
}

function sep1 (rule, separator) {
  return seq(rule, repeat(seq(separator, rule)))
}
