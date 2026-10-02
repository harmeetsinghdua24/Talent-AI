# app/analytics

Aggregate dashboard queries currently live directly in
`app/api/routers/analytics.py` since they are simple SQLAlchemy aggregate
queries (COUNT/AVG) tied closely to specific endpoints. This package is
reserved for extracting more complex analytics computations (e.g. time-
series trend calculations) into standalone, testable functions if the
analytics surface grows beyond the current three dashboard endpoints.
