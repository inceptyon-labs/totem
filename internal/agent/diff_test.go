package agent

import (
	"strings"
	"testing"
)

func TestComputeUnifiedDiff_IdenticalContent(t *testing.T) {
	content := "hello\nworld\n"
	diff := computeUnifiedDiff(content, content, "test.txt")
	if diff != "" {
		t.Errorf("expected empty diff for identical content, got: %s", diff)
	}
}

func TestComputeUnifiedDiff_NewFile(t *testing.T) {
	diff := computeUnifiedDiff("", "line1\nline2\n", "new.txt")
	if diff == "" {
		t.Fatal("expected non-empty diff for new file")
	}
	if !strings.Contains(diff, "+line1") {
		t.Errorf("expected diff to contain +line1, got: %s", diff)
	}
	if !strings.Contains(diff, "+line2") {
		t.Errorf("expected diff to contain +line2, got: %s", diff)
	}
	if !strings.Contains(diff, "a/new.txt") {
		t.Errorf("expected diff to contain file label, got: %s", diff)
	}
}

func TestComputeUnifiedDiff_ModifiedContent(t *testing.T) {
	old := "line1\nline2\nline3\n"
	new := "line1\nmodified\nline3\n"
	diff := computeUnifiedDiff(old, new, "src/main.go")
	if diff == "" {
		t.Fatal("expected non-empty diff for modified content")
	}
	if !strings.Contains(diff, "-line2") {
		t.Errorf("expected diff to contain -line2, got: %s", diff)
	}
	if !strings.Contains(diff, "+modified") {
		t.Errorf("expected diff to contain +modified, got: %s", diff)
	}
	if !strings.Contains(diff, "a/src/main.go") {
		t.Errorf("expected diff to contain file label, got: %s", diff)
	}
}
