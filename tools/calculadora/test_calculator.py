"""
Suíte de Testes Automatizados para a Calculadora Benito.

Cobre testes unitários do motor matemático (Calculator) e testes
de integração dos endpoints RESTful da aplicação Flask.
"""

import json
import math
import os
import sys
import unittest

# Garante que o diretório do módulo esteja no sys.path
_current_dir = os.path.abspath(os.path.dirname(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from calculator import (
    CalculationRecord,
    Calculator,
    DivisionByZeroError,
    InvalidOperandError,
    InvalidOperationError,
    Operation,
    format_number,
)
from app import create_app


class TestCalculatorEngine(unittest.TestCase):
    """Testes unitários da classe Calculator e utilitários matemáticos."""

    def setUp(self) -> None:
        self.calc = Calculator(max_history=5)

    def test_addition(self) -> None:
        """Testa adição de inteiros, decimais, números negativos e zero."""
        self.assertEqual(self.calc.add(10, 5), 15)
        self.assertEqual(self.calc.add(-10, 5), -5)
        self.assertEqual(self.calc.add(-10, -5), -15)
        self.assertEqual(self.calc.add(0.1, 0.2), 0.3)
        self.assertEqual(self.calc.add(0, 0), 0)

    def test_subtraction(self) -> None:
        """Testa subtração com resultados positivos, negativos e decimais."""
        self.assertEqual(self.calc.subtract(10, 4), 6)
        self.assertEqual(self.calc.subtract(4, 10), -6)
        self.assertEqual(self.calc.subtract(-5, -5), 0)
        self.assertEqual(self.calc.subtract(5.5, 2.2), 3.3)

    def test_multiplication(self) -> None:
        """Testa multiplicação de números diversos."""
        self.assertEqual(self.calc.multiply(6, 7), 42)
        self.assertEqual(self.calc.multiply(-4, 5), -20)
        self.assertEqual(self.calc.multiply(-3, -3), 9)
        self.assertEqual(self.calc.multiply(2.5, 4), 10)
        self.assertEqual(self.calc.multiply(999, 0), 0)

    def test_division(self) -> None:
        """Testa divisão exata e com casas decimais."""
        self.assertEqual(self.calc.divide(10, 2), 5)
        self.assertEqual(self.calc.divide(7, 2), 3.5)
        self.assertEqual(self.calc.divide(-15, 3), -5)
        self.assertEqual(self.calc.divide(0, 5), 0)

    def test_division_by_zero(self) -> None:
        """Garante que divisão por zero lança DivisionByZeroError."""
        with self.assertRaises(DivisionByZeroError) as ctx:
            self.calc.divide(10, 0)
        self.assertIn("Divisão por zero", str(ctx.exception))

    def test_invalid_operands(self) -> None:
        """Garante que tipos inválidos e infinitos gerem exceções adequadas."""
        with self.assertRaises(InvalidOperandError):
            self.calc.add("abc", 5)  # type: ignore

        with self.assertRaises(InvalidOperandError):
            self.calc.multiply(True, 10)  # type: ignore

        with self.assertRaises(InvalidOperandError):
            self.calc.subtract(float("nan"), 1)

        with self.assertRaises(InvalidOperandError):
            self.calc.divide(float("inf"), 2)

    def test_operation_from_string(self) -> None:
        """Testa conversão de símbolos e termos em português para Operation."""
        self.assertEqual(Operation.from_string("+"), Operation.ADD)
        self.assertEqual(Operation.from_string("soma"), Operation.ADD)
        self.assertEqual(Operation.from_string("-"), Operation.SUBTRACT)
        self.assertEqual(Operation.from_string("subtrair"), Operation.SUBTRACT)
        self.assertEqual(Operation.from_string("*"), Operation.MULTIPLY)
        self.assertEqual(Operation.from_string("x"), Operation.MULTIPLY)
        self.assertEqual(Operation.from_string("multiplicação"), Operation.MULTIPLY)
        self.assertEqual(Operation.from_string("/"), Operation.DIVIDE)
        self.assertEqual(Operation.from_string("dividir"), Operation.DIVIDE)

        with self.assertRaises(InvalidOperationError):
            Operation.from_string("raiz_quadrada_desconhecida")

    def test_calculate_method_and_history(self) -> None:
        """Testa o método calculate e a persistência em memória do histórico."""
        rec1 = self.calc.calculate(Operation.ADD, 12, 8)
        self.assertEqual(rec1.result, 20)
        self.assertEqual(rec1.expression, "12 + 8 = 20")
        self.assertEqual(rec1.symbol, "+")

        rec2 = self.calc.calculate("divide", 50, 2)
        self.assertEqual(rec2.result, 25)

        history = self.calc.get_history()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].result, 20)
        self.assertEqual(history[1].result, 25)

        self.calc.clear_history()
        self.assertEqual(len(self.calc.get_history()), 0)

    def test_history_capacity_limit(self) -> None:
        """Verifica se o histórico respeita a capacidade máxima configurada."""
        small_calc = Calculator(max_history=3)
        for i in range(5):
            small_calc.calculate("add", i, 1)

        history = small_calc.get_history()
        self.assertEqual(len(history), 3)
        self.assertEqual(history[-1].a, 4)

    def test_format_number_utility(self) -> None:
        """Testa conversão de float para int quando exato e arredondamento."""
        self.assertEqual(format_number(4.0), 4)
        self.assertIsInstance(format_number(4.0), int)
        self.assertEqual(format_number(4.5), 4.5)
        self.assertIsInstance(format_number(4.5), float)


class TestFlaskCalculatorAPI(unittest.TestCase):
    """Testes dos endpoints HTTP da aplicação Flask."""

    def setUp(self) -> None:
        self.app = create_app(testing=True)
        self.client = self.app.test_client()

    def test_index_route(self) -> None:
        """Verifica se a rota raiz (GET /) renderiza a página HTML com sucesso."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Benito Calculadora", response.get_data(as_text=True))
        self.assertIn("mainDisplay", response.get_data(as_text=True))

    def test_health_route(self) -> None:
        """Verifica o endpoint de healthcheck (GET /api/health)."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "benito-calculadora")

    def test_calculate_addition(self) -> None:
        """Verifica cálculo de soma via POST /api/calculate."""
        response = self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "add", "a": 15, "b": 27}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["result"], 42)
        self.assertEqual(data["expression"], "15 + 27 = 42")

    def test_calculate_subtraction(self) -> None:
        """Verifica cálculo de subtração via POST /api/calculate."""
        response = self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "subtract", "a": 50, "b": 18}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["result"], 32)

    def test_calculate_multiplication(self) -> None:
        """Verifica cálculo de multiplicação via POST /api/calculate."""
        response = self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "multiply", "a": 7, "b": 8}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["result"], 56)

    def test_calculate_division(self) -> None:
        """Verifica cálculo de divisão via POST /api/calculate."""
        response = self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "divide", "a": 100, "b": 4}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["result"], 25)

    def test_calculate_division_by_zero(self) -> None:
        """Verifica se divisão por zero retorna HTTP 400 com mensagem adequada."""
        response = self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "divide", "a": 10, "b": 0}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertEqual(data["code"], "DIVISION_BY_ZERO")
        self.assertIn("Divisão por zero não é permitida", data["error"])

    def test_calculate_missing_fields(self) -> None:
        """Verifica se payload sem campos obrigatórios retorna HTTP 400."""
        response = self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "add", "a": 10}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("Campos obrigatórios ausentes", data["error"])

    def test_calculate_invalid_operation(self) -> None:
        """Verifica se operação desconhecida retorna HTTP 400."""
        response = self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "op_inexistente", "a": 10, "b": 2}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertEqual(data["code"], "INVALID_INPUT")

    def test_history_workflow(self) -> None:
        """Verifica fluxo completo de consulta e limpeza de histórico via API."""
        # 1. Faz dois cálculos
        self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "add", "a": 2, "b": 3}),
            content_type="application/json",
        )
        self.client.post(
            "/api/calculate",
            data=json.dumps({"operation": "multiply", "a": 4, "b": 5}),
            content_type="application/json",
        )

        # 2. Consulta histórico
        res_history = self.client.get("/api/history")
        self.assertEqual(res_history.status_code, 200)
        history_data = res_history.get_json()
        self.assertTrue(history_data["success"])
        self.assertEqual(history_data["total"], 2)

        # 3. Limpa histórico
        res_delete = self.client.delete("/api/history")
        self.assertEqual(res_delete.status_code, 200)
        delete_data = res_delete.get_json()
        self.assertTrue(delete_data["success"])

        # 4. Verifica histórico vazio
        res_after = self.client.get("/api/history")
        after_data = res_after.get_json()
        self.assertEqual(after_data["total"], 0)


if __name__ == "__main__":
    unittest.main()
