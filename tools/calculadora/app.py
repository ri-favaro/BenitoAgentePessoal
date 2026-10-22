"""
Aplicação Web Flask para a Calculadora Benito.

Serve a interface web responsiva (HTML/CSS/JS) e expõe endpoints RESTful
para execução de operações aritméticas, consulta de histórico e healthcheck.
"""

import os
import sys
from typing import Any, Dict, Tuple
from flask import Flask, jsonify, render_template, request, Response

# Garante que o diretório do módulo esteja no sys.path
_current_dir = os.path.abspath(os.path.dirname(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from calculator import (
    Calculator,
    CalculatorError,
    DivisionByZeroError,
    InvalidOperandError,
    InvalidOperationError,
)


def create_app(testing: bool = False) -> Flask:
    """
    Fábrica da aplicação Flask.

    Args:
        testing: Indica se a aplicação está em modo de teste automatizado.

    Returns:
        Instância configurada do Flask.
    """
    base_dir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(
        __name__,
        static_folder=os.path.join(base_dir, "static"),
        template_folder=os.path.join(base_dir, "templates"),
    )

    app.config["TESTING"] = testing
    app.config["JSON_AS_ASCII"] = False

    calculator = Calculator(max_history=50)

    @app.after_request
    def add_cors_headers(response: Response) -> Response:
        """Adiciona headers CORS para permitir integração transparente."""
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
        return response

    @app.route("/", methods=["GET"])
    def index() -> str:
        """Renderiza a interface gráfica da calculadora."""
        return render_template("index.html")

    @app.route("/api/health", methods=["GET"])
    def health() -> Tuple[Response, int]:
        """Endpoint de verificação de integridade da API."""
        return jsonify({
            "status": "ok",
            "service": "benito-calculadora",
            "version": "1.0.0",
        }), 200

    @app.route("/api/calculate", methods=["POST", "OPTIONS"])
    def calculate() -> Tuple[Response, int]:
        """
        Executa uma operação de cálculo aritmético.

        Payload JSON esperado:
            {
                "operation": "add" | "subtract" | "multiply" | "divide",
                "a": number,
                "b": number
            }
        """
        if request.method == "OPTIONS":
            return jsonify({}), 200

        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Requisição inválida. O corpo da requisição deve ser um objeto JSON.",
            }), 400

        operation = data.get("operation")
        a = data.get("a")
        b = data.get("b")

        if operation is None or a is None or b is None:
            return jsonify({
                "success": False,
                "error": "Campos obrigatórios ausentes. É necessário informar 'operation', 'a' e 'b'.",
            }), 400

        try:
            record = calculator.calculate(operation=operation, a=a, b=b)
            return jsonify({
                "success": True,
                "result": record.result,
                "expression": record.expression,
                "symbol": record.symbol,
                "operation": record.operation,
                "record": record.to_dict(),
            }), 200

        except DivisionByZeroError as exc:
            return jsonify({
                "success": False,
                "error": str(exc),
                "code": "DIVISION_BY_ZERO",
            }), 400

        except (InvalidOperationError, InvalidOperandError) as exc:
            return jsonify({
                "success": False,
                "error": str(exc),
                "code": "INVALID_INPUT",
            }), 400

        except CalculatorError as exc:
            return jsonify({
                "success": False,
                "error": f"Erro de cálculo: {str(exc)}",
                "code": "CALCULATOR_ERROR",
            }), 400

        except Exception as exc:
            return jsonify({
                "success": False,
                "error": f"Erro interno inesperado: {str(exc)}",
                "code": "INTERNAL_ERROR",
            }), 500

    @app.route("/api/history", methods=["GET"])
    def get_history() -> Tuple[Response, int]:
        """Retorna o histórico dos cálculos realizados nesta sessão."""
        history = [item.to_dict() for item in calculator.get_history()]
        return jsonify({
            "success": True,
            "total": len(history),
            "history": history,
        }), 200

    @app.route("/api/history", methods=["DELETE"])
    def clear_history() -> Tuple[Response, int]:
        """Limpa o histórico de cálculos da calculadora."""
        calculator.clear_history()
        return jsonify({
            "success": True,
            "message": "Histórico de cálculos limpo com sucesso.",
        }), 200

    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app_instance = create_app()
    print(f"🚀 Benito Calculadora iniciada em: http://127.0.0.1:{port}")
    app_instance.run(host="127.0.0.1", port=port, debug=True)
